import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SparovatModalComponentComponent } from './sparovat-modal.component.component';

describe('SparovatModalComponentComponent', () => {
  let component: SparovatModalComponentComponent;
  let fixture: ComponentFixture<SparovatModalComponentComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [SparovatModalComponentComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SparovatModalComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
