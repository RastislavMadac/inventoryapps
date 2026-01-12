import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NovyProduktModalComponent } from './novy-produkt-modal.component';

describe('NovyProduktModalComponent', () => {
  let component: NovyProduktModalComponent;
  let fixture: ComponentFixture<NovyProduktModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [NovyProduktModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NovyProduktModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
