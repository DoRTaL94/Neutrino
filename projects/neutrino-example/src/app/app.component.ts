import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'neutrino-example';
  value = '';

  public onValueChanged(value: string) {
    this.value = value;
  }

  public onKeyUp(event: KeyboardEvent) {
    this.value = (event.target as HTMLTextAreaElement).value;
  }
}
