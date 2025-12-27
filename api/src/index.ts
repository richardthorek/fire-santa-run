// Central entrypoint that imports all function modules so the Azure Functions
// TypeScript build emits a single `dist/index.js` the Functions host can load.

import './brigades';
import './rfs-stations';
import './routes';
import './users';
import './members';
import './invitations';
import './verification';
import './admin-verification';
import './negotiate';
import './broadcast';
import './claim';

// Import utils to ensure they are compiled
import './utils/auth';
import './utils/emailValidation';

export default {};
