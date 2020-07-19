import { NgModule } from '@angular/core';
import { NeutrinoComponent } from './neutrino.component';
import { CommonModule } from '@angular/common';


@NgModule({
  declarations: [NeutrinoComponent],
  imports: [
    CommonModule
  ],
  exports: [NeutrinoComponent]
})
export class NeutrinoModule { }
