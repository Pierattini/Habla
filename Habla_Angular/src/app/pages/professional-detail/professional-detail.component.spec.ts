import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ProfessionalDetailComponent } from './professional-detail.component';

describe('ProfessionalDetailComponent', () => {
  let component: ProfessionalDetailComponent;
  let fixture: ComponentFixture<ProfessionalDetailComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ProfessionalDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
