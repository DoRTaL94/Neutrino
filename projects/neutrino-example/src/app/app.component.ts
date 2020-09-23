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
  fontSizeStr = '1.6rem';
  fontSize = 1.6;

  public onValueChanged(value: string) {
    this.value = value;
  }

  public onKeyUp(event: KeyboardEvent) {
    this.value = (event.target as HTMLTextAreaElement).value;
  }

  public increaseFontSize(): void {
    this.fontSize += 0.5;
    this.fontSizeStr = `${this.fontSize}rem`;
  }

  public decreaseFontSize(): void {
    this.fontSize -= 0.5;
    this.fontSizeStr = `${this.fontSize}rem`;
  }
}
