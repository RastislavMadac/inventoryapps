import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CalculatorModalComponent } from './calculator-modal.component';

describe('CalculatorModalComponent', () => {
  let component: CalculatorModalComponent;
  let fixture: ComponentFixture<CalculatorModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CalculatorModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalculatorModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
