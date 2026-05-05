import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ChatDetailComponent } from './chat-detail.component';

describe('ChatDetailComponent', () => {
  let component: ChatDetailComponent;
  let fixture: ComponentFixture<ChatDetailComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ChatDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
