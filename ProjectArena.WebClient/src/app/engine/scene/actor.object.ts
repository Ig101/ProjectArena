import { Scene } from './scene.object';
import { IActor } from '../interfaces/actor.interface';
import { Player } from './abstract/player.object';
import { Action } from '../models/abstract/action.model';
import { Reaction, KILL_EFFECT_NAME } from '../models/abstract/reaction.model';
import { Buff } from '../models/abstract/buff.model';
import { removeFromArray } from 'src/app/helpers/extensions/array.extension';
import { Color } from 'src/app/shared/models/color.model';
import { ActorSynchronization } from 'src/app/shared/models/synchronization/objects/actor-synchronization.model';
import { ActorReference } from 'src/app/shared/models/synchronization/objects/actor-reference.model';
import { BuffSynchronization } from 'src/app/shared/models/synchronization/objects/buff-synchronization.model';
import { ActionClassEnum } from '../models/enums/action-class.enum';

const maxinitiative = 10;
const mininitiative = 1;
const maxReactionsDepth = 100;

export class Actor implements IActor {

  id: number;

  char: string;
  color: Color;
  left: boolean;

  isAlive: boolean;

  tags: string[];

  name: string;
  changed: boolean;
  latestX: number;
  latestY: number;

  actors: Actor[];
  parentActor: IActor;
  parentScene: Scene;
  owner: Player;

  selfMaxDurability: number;
  durability: number;

  selfinitiative: number;

  height: number;
  volume: number;
  freeVolume: number;

  buffs: Buff[];
  selfActions: Action[];
  preparationReactions: Reaction[];
  activeReactions: Reaction[];
  clearReactions: Reaction[];

  maxDurability: number;
  initiative: number;
  actions: Action[] = [];
  blockedActions: string[] = [];
  blockedEffects: string[] = [];

  get isRoot() {
    return false;
  }

  get x() {
    return this.parentActor.x;
  }

  get y() {
    return this.parentActor.y;
  }

  get z() {
    return this.parentActor.getActorZ(this);
  }

  get reference(): ActorReference {
    return {
      x: this.x,
      y: this.y,
      id: this.id
    };
  }

  constructor(
    scene: Scene,
    parent: IActor,
    synchronizer: ActorSynchronization
  ) {
    this.id = synchronizer.reference.id;
    this.name = synchronizer.name;
    this.parentScene = scene;
    this.isAlive = true;
    this.left = synchronizer.left;
    this.parentActor = parent;
    this.owner = synchronizer.ownerId ? this.parentScene.players.find(x => x.id === synchronizer.ownerId) : undefined;
    this.char = synchronizer.char;
    this.color = synchronizer.color;
    this.tags = synchronizer.tags;
    this.durability = synchronizer.durability;
    this.selfMaxDurability = synchronizer.maxDurability;
    this.maxDurability = synchronizer.maxDurability;
    this.selfinitiative = synchronizer.initiative;
    this.initiative = synchronizer.initiative;
    this.height = synchronizer.height;
    this.volume = synchronizer.volume;
    this.freeVolume = synchronizer.freeVolume;
    this.preparationReactions = synchronizer.preparationReactions.map(x => scene.nativesCollection.buildReaction(x));
    this.activeReactions = synchronizer.activeReactions.map(x => scene.nativesCollection.buildReaction(x));
    this.clearReactions = synchronizer.clearReactions.map(x => scene.nativesCollection.buildReaction(x));
    this.selfActions = synchronizer.actions.map(x => scene.nativesCollection.buildAction(x));
    this.actions = [...this.selfActions];
    this.buffs = [];
    synchronizer.buffs.forEach(x => this.applyBuff(scene.nativesCollection.buildBuff(x)));
    this.actors = synchronizer.actors.map(x => new Actor(scene, this, x));
    this.latestX = this.x;
    this.latestY = this.y;
  }

  getActorZ(actor: Actor) {
    return this.z + this.height;
  }

  validateTargeted(action: Action, x: number, y: number) {
    if (action.remainedTime > 0) {
      return 'Action is not ready';
    }
    if (action.native.validateActionTargeted) {
      return action.native.validateActionTargeted(this, x, y);
    } else {
      return undefined;
    }
  }

  validateOnObject(action: Action, target: IActor) {
    if (action.remainedTime > 0) {
      return 'Action is not ready';
    }
    if (action.native.validateActionOnObject) {
      action.native.validateActionOnObject(this, target);
    } else {
      return undefined;
    }
  }

  actTargeted(action: Action, x: number, y: number) {
    if (this.isAlive && action.native.actionTargeted) {
      this.setChanged();
      action.remainedTime = action.native.cooldown;
      if (x > this.x) {
        this.left = false;
      }
      if (x < this.x) {
        this.left = true;
      }
      this.parentScene.pushChanges(
        action.native.actionTargeted(this, action.native.power, x, y, this.parentScene.timeLine));
    }
  }

  actOnObject(action: Action, target: IActor) {
    if (this.isAlive && action.native.actionOnObject) {
      this.setChanged();
      action.remainedTime = action.native.cooldown;
      if (target.x > this.x) {
        this.left = false;
      }
      if (target.x < this.x) {
        this.left = true;
      }
      this.parentScene.pushChanges(
        action.native.actionOnObject(this, action.native.power, action.native.scopeSize, target, this.parentScene.timeLine));
    }
  }

  private processReactions(reactions: Reaction[], inlineEffects: string[], inlinePower: number,
                           containerized: boolean, order: number, startingTime: number, issuer: Actor): number {
    if (reactions) {
      for (const reaction of reactions) {
        if (inlineEffects.includes(reaction.native.respondsOn)) {
          const reactionResult =
            reaction.native.action(this, inlinePower, reaction.mod, containerized, order + 1, startingTime, issuer);
          inlinePower = reactionResult.power;
          this.parentScene.pushChanges(reactionResult.changes);
        }
      }
    }
    return inlinePower;
  }

  handleEffects(effects: string[], power: number, containerized: boolean, order: number, startingTime: number, issuer: Actor) {
    if (!this.isAlive || order > maxReactionsDepth) {
      return power;
    }
    const tempEffects = this.blockedEffects.length > 0 ? effects.filter(x => !this.blockedEffects.includes(x)) : effects;
    if (tempEffects.length === 0) {
      return power;
    }

    let tempPower = power;

    tempPower = this.processReactions(this.preparationReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    for (const buff of this.buffs) {
      tempPower = this.processReactions(buff.addedPreparationReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    }

    tempPower = this.processReactions(this.activeReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    for (const buff of this.buffs) {
      tempPower = this.processReactions(buff.addedActiveReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    }

    tempPower = this.processReactions(this.clearReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    for (const buff of this.buffs) {
      tempPower = this.processReactions(buff.addedClearReactions, tempEffects, tempPower, containerized, order, startingTime, issuer);
    }

    let resultPower = tempPower;
    for (const actor of this.actors) {
      const powerChange = actor.handleEffects(effects, tempPower, true, order + 1, startingTime, issuer) - tempPower;
      resultPower += powerChange;
    }
    return resultPower;
  }

  private calculateBuffPower(buff: Buff) {
    return buff.counter * 1000 + (buff.duration !== undefined ? buff.duration : 999);
  }

  kill() {
    this.isAlive = false;
    this.handleEffects([KILL_EFFECT_NAME], 1, false, 0, this.parentScene.timeLine, undefined);
    this.parentActor.removeActor(this);
    for (const inside of this.actors) {
      this.parentActor.addActorOnTop(inside);
    }
    this.actors.length = 0;
  }

  applyBuff(buff: Buff) {
    this.setChanged();
    this.buffs.push(buff);
    const sameBuffs = this.buffs.filter(x => x.id === buff.id);
    const haveExtraBuffs = buff.maxStacks < sameBuffs.length;
    if (haveExtraBuffs) {
      const extraBuff = this.buffs.sort((a, b) => this.calculateBuffPower(a) - this.calculateBuffPower(b))[0];
      removeFromArray(this.buffs, extraBuff);
      this.initiative -= buff.changedSpeed;
      if (this.initiative > maxinitiative) {
        this.initiative = maxinitiative;
      }
      if (this.initiative < mininitiative) {
        this.initiative = mininitiative;
      }
      const oldDurability = this.maxDurability - buff.changedDurability;
      if (oldDurability < 0) {
        this.durability = 1;
      } else if (oldDurability !== this.maxDurability) {
        const difference = oldDurability / this.maxDurability;
        this.durability = difference > 0 ? difference * this.durability : 1;
      }
      this.maxDurability = oldDurability;
    }
    this.initiative += buff.changedSpeed;
    if (this.initiative > maxinitiative) {
      buff.changedSpeed -= (maxinitiative - this.initiative);
      this.initiative = maxinitiative;
    }
    if (this.initiative < mininitiative) {
      buff.changedSpeed += (mininitiative - this.initiative);
      this.initiative = mininitiative;
    }

    const newDurability = this.maxDurability + buff.changedDurability;
    if (newDurability < 0) {
      this.durability = 1;
    } else if (newDurability !== this.maxDurability) {
      const difference = newDurability / this.maxDurability;
      this.durability = difference > 0 ? difference * this.durability : 1;
    }
    this.maxDurability = newDurability;

    if (!haveExtraBuffs) {
      this.blockedEffects.push(...buff.blockedEffects);
      this.blockedActions.push(...buff.blockedActions);
      if (buff.blockAllActions) {
        this.actions.length = 0;
      } else {
        this.actions = [...this.actions, ...buff.addedActions].filter(x => this.blockedActions.includes(x.id));
      }
    }
  }

  purgeBuffs() {
    this.setChanged();
    this.buffs.length = 0;
    this.blockedEffects.length = 0;
    this.blockedActions.length = 0;
    const difference = this.selfMaxDurability / this.maxDurability;
    this.durability = difference > 0 ? difference * this.durability : 1;
    this.maxDurability = this.selfMaxDurability;
    this.initiative = this.selfinitiative;
    this.actions = [...this.selfActions];
  }

  update() {
    this.actions.forEach(x => {
      if (x.remainedTime > 0 &&
        (x.native.actionClass === ActionClassEnum.Autocast ||
          this.id === this.parentScene.currentActor?.id)) {

        x.remainedTime--;
      }
    });
    let buffRemoved = false;
    for (const buff of this.buffs) {
      if (buff.duration !== undefined && (!buff.updatesOnTurnOnly || this.parentScene.currentActor.id === this.id || !this.owner)) {
        buff.duration--;
      }
      if (buff.duration !== undefined && buff.duration <= 0) {
        buffRemoved = true;
        this.initiative -= buff.changedSpeed;
        if (this.initiative > maxinitiative) {
          this.initiative = maxinitiative;
        }
        if (this.initiative < mininitiative) {
          this.initiative = mininitiative;
        }
        const newDurability = this.maxDurability - buff.changedDurability;
        if (newDurability < 0) {
          this.durability = 1;
        } else if (newDurability !== this.maxDurability) {
          const difference = newDurability / this.maxDurability;
          this.durability = difference > 0 ? difference * this.durability : 1;
        }
        this.maxDurability = newDurability;
      }
    }
    if (buffRemoved) {
      this.setChanged();
      this.buffs = this.buffs.filter(x => x.duration > 0);
      this.blockedEffects.length = 0;
      this.blockedActions.length = 0;
      this.actions = [...this.selfActions];
      let blockAllActions = false;
      for (const buff of this.buffs) {
        this.blockedEffects.push(...buff.blockedEffects);
        this.blockedActions.push(...buff.blockedActions);
        blockAllActions = blockAllActions || buff.blockAllActions;
        if (blockAllActions) {
          this.actions.length = 0;
        } else {
          this.actions = [...this.actions, ...buff.addedActions].filter(x => this.blockedActions.includes(x.id));
        }
      }
    }
    for (const actor of this.actors) {
      actor.update();
    }
  }

  changeDurability(durability: number) {
    this.setChanged();
    this.durability += durability;
    if (this.durability <= 0) {
      this.kill();
    }
    if (this.durability > this.maxDurability) {
      this.durability = this.maxDurability;
    }
  }

  addActorOnTop(actor: Actor) {
    this.setChanged();
    actor.parentActor = this;
    this.actors.push(actor);
  }

  addActor(actor: Actor, index: number) {
    if (index >= this.actors.length) {
      this.addActorOnTop(actor);
      return;
    }
    actor.parentActor = this;
    this.setChanged();
    this.actors.splice(Math.max(0, index), 0, actor);
  }

  removeActor(actor: Actor) {
    this.parentScene.removedActors.push(actor.reference);
    removeFromArray(this.actors, actor);
  }

  move(target: IActor) {
    this.setChanged();
    this.parentActor.removeActor(this);
    target.addActorOnTop(this);
  }

  moveToIndex(target: IActor, index: number) {
    this.setChanged();
    this.parentActor.removeActor(this);
    target.addActor(this, index);
  }

  findActor(id: number): Actor {
    if (this.id === id) {
      return this;
    }
    for (const actor of this.actors) {
      const neededActor = actor.findActor(id);
      if (neededActor) {
        return neededActor;
      }
    }
    return undefined;
  }

  createSynchronizerAndClearInfo() {
    const result = {
      reference: {
        x: this.latestX,
        y: this.latestY,
        id: this.id
      },
      position: this.parentActor.actors.indexOf(this),
      parentId: this.parentActor.id,
      char: this.char,
      color: this.color,
      height: this.height,
      volume: this.volume,
      freeVolume: this.freeVolume,
      durability: this.durability,
      maxDurability: this.selfMaxDurability,
      initiative: this.selfinitiative,
      left: this.left,
      actors: this.actors.filter(x => x.changed).map(x => x.createSynchronizerAndClearInfo()),
      actions: this.selfActions.map(x => ({
        id: x.id,
        isAutomatic: x.native.actionClass === ActionClassEnum.Autocast,
        blocked: !this.actions.some(a => a.id === x.id),
        remainedTime: x.remainedTime
      })),
      ownerId: this.owner?.id,
      preparationReactions: this.preparationReactions.map(x => ({
        id: x.id,
        mod: x.mod
      })),
      activeReactions: this.activeReactions.map(x => ({
        id: x.id,
        mod: x.mod
      })),
      clearReactions: this.clearReactions.map(x => ({
        id: x.id,
        mod: x.mod
      })),
      buffs: this.buffs.map(x => {
        return {
          id: x.id,
          duration: x.duration,
          maxStacks: x.maxStacks,
          counter: x.counter,
          changedDurability: x.changedDurability,
          changedSpeed: x.changedSpeed,
          actions: x.addedActions.map(a => ({
            id: a.id,
            isAutomatic: a.native.actionClass === ActionClassEnum.Autocast,
            blocked: !this.actions.some(aA => a.id === aA.id),
            remainedTime: a.remainedTime
          })),
          addedPreparationReactions: x.addedPreparationReactions.map(a => ({
            id: a.id,
            mod: a.mod
          })),
          addedClearReactions: x.addedClearReactions.map(a => ({
            id: a.id,
            mod: a.mod
          })),
          addedActiveReactions: x.addedActiveReactions.map(a => ({
            id: a.id,
            mod: a.mod
          })),
        } as BuffSynchronization;
      })
    } as ActorSynchronization;
    this.changed = false;
    this.latestX = this.x;
    this.latestY = this.y;
    return result;
  }

  getActiveActors() {
    const activeActors = this.owner && this.actions.some(x =>
      x.remainedTime <= 0 &&
      (x.native.actionClass === ActionClassEnum.Attack ||
      x.native.actionClass === ActionClassEnum.Move ||
      x.native.actionClass === ActionClassEnum.Default)) ? [this as Actor] : [];
    return activeActors;
  }

  getNeighboursByScope(scope: number) {
    if (scope === 0) {
      return [this];
    }
    if (this.parentActor.isRoot) {
      const actors: Actor[] = [this];
      const midHeight = this.z + this.height / 2;
      const lowerBound = midHeight - scope;
      const highBound = midHeight + scope;
      let z = 0;
      for (const actor of this.parentActor.actors) {
        if (z > highBound) {
          break;
        }
        if (z + actor.height >= lowerBound) {
          actors.push(actor);
        }
        z += actor.height;
      }
      return actors;
    } else {
      return this.parentActor.actors;
    }
  }

  getChildrenByScope(height: number, scope: number) {
    return this.actors;
  }

  setChanged() {
    this.changed = true;
    this.parentActor.setChanged();
  }
}
