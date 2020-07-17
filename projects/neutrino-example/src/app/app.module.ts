import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { NeutrinoModule } from 'neutrino';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    NeutrinoModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
