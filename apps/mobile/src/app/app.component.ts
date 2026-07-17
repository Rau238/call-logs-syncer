import { Component, OnInit } from '@angular/core';
import { AppInitializerService } from './core/services/app-initializer.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private appInit: AppInitializerService) {}

  async ngOnInit(): Promise<void> {
    await this.appInit.initialize();
  }
}
