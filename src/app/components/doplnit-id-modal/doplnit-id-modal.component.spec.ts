import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DoplnitIdModalComponent } from './doplnit-id-modal.component';

describe('DoplnitIdModalComponent', () => {
  let component: DoplnitIdModalComponent;
  let fixture: ComponentFixture<DoplnitIdModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DoplnitIdModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoplnitIdModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
