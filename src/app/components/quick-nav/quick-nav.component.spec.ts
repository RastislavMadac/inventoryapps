import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { QuickNavComponent } from './quick-nav.component';

describe('QuickNavComponent', () => {
  let component: QuickNavComponent;
  let fixture: ComponentFixture<QuickNavComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [QuickNavComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
