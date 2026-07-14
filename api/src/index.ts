// Central entrypoint that imports all function modules so the Azure Functions
// TypeScript build emits a single `dist/index.js` the Functions host can load.

import './health';
import './brigades';
import './fire-stations';
import './routes';
import './users';
import './members';
import './invitations';
import './verification';
import './admin-verification';
import './negotiate';
import './broadcast';
import './claim';
import './og-image';
import './push';

// Import utils to ensure they are compiled
import './utils/auth';
import './utils/emailValidation';

export default {};
