import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  public title = 'neutrino-example';
  public value = ''; // 'public class Example {\n\tpublic static void SayHello() {\n\t\t\n\t}\n}';
  public codeType = 'java';
  public fontSizeStr = '1.2rem';
  public fontSize = 1.2;
  public tabSpaces = 2;

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

  public incTabLength(): void {
    this.tabSpaces++;
  }

  public decTabLength(): void {
    this.tabSpaces--;

    if (this.tabSpaces < 2) {
      this.tabSpaces = 2;
    }
  }
}
