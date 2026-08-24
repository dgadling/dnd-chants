export const STORAGE_KEYS = {
  // Characters
  CHARACTERS: "dnd-chant-characters-v1",
  ACTIVE_ID: "dnd-chant-active-character-v1",
  DDB_LINK: "dnd-chant-ddb-link-v1",

  // Per-character data
  SCHOOL_LANGS: "dnd-chant-school-langs-v1",
  EXTRAS: "dnd-chant-extras-v1",

  // UI / preferences
  HELP_TEMPLATE: "dnd-chant-help-template-v1",
  THEME: "dnd-chant-theme-v1",
  WELCOME: "dnd-chant-welcome-seen-v1",

  // Backup / cloud
  BACKUP_ENABLED: "dnd-chant-backup-enabled-v1",
  LAST_BACKUP: "dnd-chant-last-backup-v1",
  LAST_BACKUP_SIZE: "dnd-chant-last-backup-size-v1",
  LAST_CLOUD_ACTION: "dnd-chant-last-cloud-action",
  BACKUP_KEY: "dnd-chant-backup-key",
  PENDING_PIN: "dnd-chant-pending-pin",
  STATE: "dnd-chant-discord-state",

  // Auth
  DISCORD_USER: "dnd-chant-discord-user-v1",
} as const;
