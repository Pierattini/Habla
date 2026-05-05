import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ProfessionalDashboardComponent } from './professional-dashboard.component';

describe('ProfessionalDashboardComponent', () => {
  let component: ProfessionalDashboardComponent;
  let fixture: ComponentFixture<ProfessionalDashboardComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ProfessionalDashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
