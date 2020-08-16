import { Component, OnInit, Input } from '@angular/core';
import { ContextMenuItem } from '../../models/context-menu-item.model';

@Component({
  selector: 'app-context-menu-item',
  templateUrl: './context-menu-item.component.html',
  styleUrls: ['./context-menu-item.component.scss']
})
export class ContextMenuItemComponent implements OnInit {

  @Input() item: ContextMenuItem;
  @Input() current: boolean;
  @Input() conflict: boolean;

  tooltip = false;
  supress = false;

  timer;

  constructor() { }

  ngOnInit() {
  }

  switchTooltip(event: MouseEvent, on: boolean) {
    if (!on && this.tooltip) {
      this.timer = setTimeout(() => {this.supress = false; }, 200);
    }
    this.tooltip = on;
    if (on) {
      clearTimeout(this.timer);
      this.supress = true;
    }
  }
}
