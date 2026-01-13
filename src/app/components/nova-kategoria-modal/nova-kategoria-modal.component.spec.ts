import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NovaKategoriaModalComponent } from './nova-kategoria-modal.component';

describe('NovaKategoriaModalComponent', () => {
  let component: NovaKategoriaModalComponent;
  let fixture: ComponentFixture<NovaKategoriaModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [NovaKategoriaModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NovaKategoriaModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
