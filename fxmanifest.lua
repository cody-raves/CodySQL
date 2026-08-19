fx_version 'cerulean'
game 'gta5'

name 'codysql'
author 'Cody & contributors'
description 'In-game MySQL/MariaDB manager for FiveM - browse, edit, query, run SQL files, audit, and back up your live database without leaving the game.'
version '0.1.0'
repository 'https://github.com/cody-raves/CodySQL'
lua54 'yes'

shared_script 'config.lua'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/util.lua',
    'server/permissions.lua',
    'server/audit.lua',
    'server/database.lua',
    'server/sqlfiles.lua',
    'server/backups.lua',
    'server/main.lua',
}

client_scripts {
    'client/main.lua',
}

-- The NUI is a React app; the built bundle lives in web/dist.
-- Rebuild with: cd web && npm install && npm run build
ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/**/*',
    'web/dist/logo.png',
}

dependency 'oxmysql'
