import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CallLogPage } from './call-log.page';

const routes: Routes = [
  {
    path: '',
    component: CallLogPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CallLogPageRoutingModule {}
