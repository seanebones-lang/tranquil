// Next.js 16+ no longer ships `next lint`; use ESLint flat config directly.
const nextConfigs = require("eslint-config-next/core-web-vitals");

module.exports = [...nextConfigs];
