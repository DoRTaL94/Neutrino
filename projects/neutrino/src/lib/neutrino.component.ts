import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'nt-editor',
  templateUrl: './neutrino.component.html',
  styleUrls: ['./neutrino.component.css']
})
export class NeutrinoComponent implements OnInit {
  @Input()
  public tabSpaces = 2;

  private tab = '';

  constructor() {
  }

  ngOnInit(): void {
    this.initTab();
  }

  initTab() {
    for (let i = 0; i < this.tabSpaces; i++) {
      this.tab += '\u00a0';
    }
  }
}
