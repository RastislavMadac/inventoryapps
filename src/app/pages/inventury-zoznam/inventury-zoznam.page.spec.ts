import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventuryZoznamPage } from './inventury-zoznam.page';

describe('InventuryZoznamPage', () => {
  let component: InventuryZoznamPage;
  let fixture: ComponentFixture<InventuryZoznamPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(InventuryZoznamPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
