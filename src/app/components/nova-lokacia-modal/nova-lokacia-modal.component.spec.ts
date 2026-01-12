import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NovaLokaciaModalComponent } from './nova-lokacia-modal.component';

describe('NovaLokaciaModalComponent', () => {
  let component: NovaLokaciaModalComponent;
  let fixture: ComponentFixture<NovaLokaciaModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [NovaLokaciaModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NovaLokaciaModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
