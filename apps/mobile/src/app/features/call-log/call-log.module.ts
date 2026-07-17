import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { CallLogPageRoutingModule } from './call-log-routing.module';
import { CallLogPage } from './call-log.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CallLogPageRoutingModule],
  declarations: [CallLogPage],
})
export class CallLogPageModule {}
