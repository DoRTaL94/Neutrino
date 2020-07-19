import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { EventType, NeutrinoService } from './neutrino.service';

@Component({
  selector: 'nt-editor',
  templateUrl: './neutrino.component.html',
  styleUrls: ['./neutrino.component.css']
})
export class NeutrinoComponent implements OnDestroy, AfterViewInit {
  @ViewChild('editor', { read: ElementRef })
  editor: ElementRef;

  @Input()
  public tabSpaces = 2;
  @Output()
  public valueChanged = new EventEmitter<string>();

  private valueChangedSub: Subscription;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2
  ) { }

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

    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleDeletion.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleInsertTab.bind(this));
    this.neutrinoService.addEventHandler(this.editor, EventType.KeyDown, this.handleAutoComplete.bind(this));
  }

  onKeyDown(event: KeyboardEvent): void {
    this.neutrinoService.handleEvent(this.editor, event);
  }

  onKeyUp(event: KeyboardEvent): void {
    this.neutrinoService.handleEvent(this.editor, event);
  }

  onMouseClick(event: MouseEvent): void {
    this.neutrinoService.handleEvent(this.editor, event);
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
