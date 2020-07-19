import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { Subscription } from 'rxjs';
import { EventType, NeutrinoService } from './neutrino.service';

@Component({
  selector: 'nt-editor',
  templateUrl: './neutrino.component.html',
  styleUrls: ['./neutrino.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class NeutrinoComponent implements OnDestroy, OnInit, AfterViewInit, OnChanges {
  @ViewChild('editor')
  editor: ElementRef;

  @Input()
  public tabSpaces = 2;
  @Input()
  public showLineNumber: boolean;
  @Input()
  public value: string;
  @Output()
  public valueChanged = new EventEmitter<string>();

  public lines = [1];
  private valueChangedSub: Subscription;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.value && this.editor) {
      this.neutrinoService.render(this.editor, this.value);
      this.refreshLines();
    }
  }

  ngOnInit(): void {
    this.showLineNumber = this.showLineNumber !== undefined;
  }

  ngOnDestroy(): void {
    this.valueChangedSub.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.valueChangedSub = this.neutrinoService
    .getValueChangedListener(this.editor)
    .subscribe(value => this.valueChanged.emit(value));
    this.neutrinoService.setEditorOptions(this.editor, {
      tabSpaces: this.tabSpaces
    });
    this.neutrinoService.addEventHandler(this.editor, EventType.Input, this.refreshLines.bind(this), true);
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleDeletion.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleInsertTab.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleAutoComplete.bind(this));
  }

  public handleEvent(event: Event) {
    this.neutrinoService.handleEvent(this.editor, event);
  }

  private refreshLines(event?: KeyboardEvent): void {
    let num = 1;

    this.lines = [];
    Array.from(this.editor.nativeElement.querySelectorAll('.view-line')).forEach((node, index) => this.lines.push(num++));
    console.log(this.lines);
  }

  private handleAutoComplete(event: KeyboardEvent): void {
    let opening: Text;
    let closure: Text;

    if (event.key === '{') {
      opening = this.renderer.createText('{');
      closure = this.renderer.createText('}');
    } else if (event.key === '[') {
      opening = this.renderer.createText('[');
      closure = this.renderer.createText(']');
    } else if (event.key === '(') {
      opening = this.renderer.createText('(');
      closure = this.renderer.createText(')');
    }

    if (opening) {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);

      range.insertNode(closure);
      range.insertNode(opening);
      range.setStartBefore(closure);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      event.preventDefault();
    }
  }

  private handleDeletion(event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const line = this.neutrinoService.getClosestViewLine(this.editor);
      const emptyLine = line.textContent === '';
      const oneLine = this.editor.nativeElement.querySelectorAll('.view-line').length === 1;

      if (emptyLine && oneLine) {
        event.preventDefault();
        return;
      }
    }
  }

  private handleInsertTab(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);
      const anchorLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.anchorNode as HTMLElement);
      const focusLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.focusNode as HTMLElement);

      // In case user selected text and pressed 'Tab', the text should be deleted and be replaced with a tab
      range.extractContents();

      // Multiline selection
      if (!anchorLine.isSameNode(focusLine)) {
        // extractContents function doesn't remove anchor line if it's empty after extraction
        if (anchorLine.textContent === '') {
          anchorLine.remove();
        }

        range.setStartAfter(focusLine.lastChild);
        range.collapse(true);
      }

      for (let i = 0 ; i < this.tabSpaces; i++) {
        const nonBreakingSpace = this.renderer.createText('\u00a0');
        range.insertNode(nonBreakingSpace);
        range.setStartAfter(nonBreakingSpace);
        range.collapse(true);
      }

      sel.removeAllRanges();
      sel.addRange(range);

      event.preventDefault();
    }
  }
}
