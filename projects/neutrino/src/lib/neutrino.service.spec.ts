import { TestBed } from '@angular/core/testing';

import { NeutrinoService } from './neutrino.service';

describe('NeutrinoService', () => {
  let service: NeutrinoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NeutrinoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
