import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'neutrino-example';
  value = ''; // 'public class Example {\n\tpublic static void SayHello() {\n\t\t\n\t}\n}';
  codeType = 'java';

  public onValueChanged(value: string) {
    this.value = value;
  }

  public onKeyUp(event: KeyboardEvent) {
    this.value = (event.target as HTMLTextAreaElement).value;
  }

  public changeCodeType(event) {
    this.value = null;
  }
}
