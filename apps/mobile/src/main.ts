import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { addIcons } from 'ionicons';
import {
  arrowDownCircle,
  arrowUpCircle,
  ban,
  bugOutline,
  call,
  callOutline,
  closeCircle,
  cloudOffline,
  cloudUploadOutline,
  handLeft,
  recording,
  shieldCheckmarkOutline,
  wifi,
} from 'ionicons/icons';

import { AppModule } from './app/app.module';

addIcons({
  'arrow-down-circle': arrowDownCircle,
  'arrow-up-circle': arrowUpCircle,
  ban,
  'bug-outline': bugOutline,
  call,
  'call-outline': callOutline,
  'close-circle': closeCircle,
  'cloud-offline': cloudOffline,
  'cloud-upload-outline': cloudUploadOutline,
  'hand-left': handLeft,
  recording,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  wifi,
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
