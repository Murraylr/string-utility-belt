const dotenv = require(process.argv[2] + '/package/lib/main.js')
const src = 'DB_PASS=abc#123\nREDIS_URL=redis://cache.example.com:6379/0  # session store\nSESSION_SECRET=\'k9$Lm#2vQ!x7-not-a-real-secret\'\nexport NODE_ENV=production\nWELCOME_TEXT="Hello,\\nyour account is ready."\nCA="-----BEGIN-----\nAAAA\n-----END-----"\nKEY = spaced value  \n'
console.log(JSON.stringify(dotenv.parse(src), null, 1))
