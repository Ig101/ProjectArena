using ProjectArena.Content.SkillNatives.Base;
using ProjectArena.Engine.ForExternalUse;
using ProjectArena.Engine.Helpers;

namespace ProjectArena.Content.SkillNatives
{
    public class MagicMissle : INative
    {
        public void Fill(INativeManager nativeManager)
        {
            nativeManager.AddSkillNative(
                "magicMissle",
                new[] { "damage", "target", "magic", "pure", "ranged", "direct" },
                5,
                3,
                4,
                40,
                new Targets()
                {
                    Allies = true,
                    NotAllies = true,
                    Unbearable = true,
                    Bearable = true,
                    Decorations = true
                },
                true,
                (scene, owner, targetTile, skill) =>
                {
                    targetTile.DoDamageSkill(skill);
                });
        }
    }
}