/**
 * The topics sold on /advertise/: each an explicit list of pages, so a sponsor buys a
 * known set of pages and a new utility joins a topic only when added here. A page
 * belongs to at most one topic (a topic sponsorship is exclusive), which
 * `sponsors.test.ts` checks along with every id and slug being real.
 */
export const SPONSOR_TOPICS = {
  'auth-tokens': {
    name: 'Auth and tokens',
    utilities: ['jwt_decode', 'jwt_verify', 'base64url_decode', 'base64url_encode'],
    recipes: ['decode-saml-request', 'decode-flask-session-cookie'],
  },
  'kubernetes-cloud': {
    name: 'Kubernetes and cloud',
    utilities: ['cron_describe', 'env_to_json', 'json_to_env', 'cidr', 'ip_convert', 'strip_ansi'],
    recipes: ['decode-kubernetes-secret', 'decode-helm-release-secret', 'decode-cloudwatch-logs-data',
      'spring-boot-yaml-to-env-vars', 'fix-bash-bad-interpreter'],
  },
  'security-hashing': {
    name: 'Security and hashing',
    utilities: ['hash', 'md5', 'sha3', 'blake', 'hmac', 'pbkdf2', 'bcrypt_hash', 'bcrypt_verify', 'argon2_hash',
      'aes_encrypt', 'aes_decrypt', 'checksum', 'checksum_verify', 'password_generator', 'random_bytes', 'entropy'],
    recipes: [],
  },
  'data-formats': {
    name: 'Data formats and SQL',
    utilities: ['json_pretty', 'json_minify', 'json_validate', 'json_diff', 'json_to_csv', 'csv_to_json', 'csv_to_sql',
      'json_to_yaml', 'yaml_to_json', 'json_to_toml', 'toml_to_json', 'json_to_xml', 'xml_to_json',
      'json_to_typescript', 'json_schema_validate', 'jsonpath', 'sql_format', 'sql_minify', 'sql_escape'],
    recipes: ['nested-json-to-csv', 'excel-column-to-sql-in-clause', 'unescape-stringified-json'],
  },
} as const satisfies Record<string, { name: string; utilities: readonly string[]; recipes: readonly string[] }>

export type SponsorTopicId = keyof typeof SPONSOR_TOPICS
