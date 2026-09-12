#!/usr/bin/env bash
# ==============================================================================
# Accounting Bot Platform for Telegram & Bale (Iran)
# Linux Installation, Update, and Management Script (Sanaei 3X-UI Style)
# Repository: https://github.com/meh732/-accountinglearn.git
# ==============================================================================

set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SERVICE_NAME="accountinglearn"
REPO_URL="https://github.com/meh732/-accountinglearn.git"
INSTALL_DIR="/opt/accountinglearn"
BIN_LINK="/usr/local/bin/accountinglearn"
BIN_LINK_SHORT="/usr/local/bin/acc-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Determine application directory
if [ -f "$(pwd)/package.json" ]; then
    APP_DIR="$(pwd)"
elif [ -d "${INSTALL_DIR}" ] && [ -f "${INSTALL_DIR}/package.json" ]; then
    APP_DIR="${INSTALL_DIR}"
else
    APP_DIR="${INSTALL_DIR}"
fi

BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="accounting_bot_backup_${TIMESTAMP}.tar.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Helper to read user input interactively even when piped through curl
prompt_user() {
    local prompt_msg="$1"
    local result_var="$2"
    local default_val="$3"
    local input_val=""

    if [ -t 0 ]; then
        read -p "${prompt_msg}" input_val
    elif (exec </dev/tty) 2>/dev/null; then
        read -p "${prompt_msg}" input_val </dev/tty 2>/dev/null || input_val=""
    else
        read -p "${prompt_msg}" input_val 2>/dev/null || input_val=""
    fi
    input_val="${input_val:-$default_val}"
    eval "${result_var}=\"${input_val}\""
}

set_env_val() {
    local key="$1"
    local val="$2"
    local env_file="${APP_DIR}/.env"
    [ -f "${env_file}" ] || touch "${env_file}"
    if grep -q "^${key}=" "${env_file}"; then
        sed -i "s|^${key}=.*|${key}=\"${val}\"|" "${env_file}"
    else
        echo "${key}=\"${val}\"" >> "${env_file}"
    fi
}

get_env_val() {
    local key="$1"
    local env_file="${APP_DIR}/.env"
    if [ -f "${env_file}" ]; then
        grep -E "^${key}=" "${env_file}" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true
    fi
}

print_banner() {
    clear 2>/dev/null || true
    echo -e "${CYAN}${BOLD}"
    echo "  █████╗  ██████╗ ██████╗  ██████╗ ██╗   ██╗███╗   ██╗████████╗"
    echo " ██╔══██╗██╔════╝██╔════╝ ██╔═══██╗██║   ██║████╗  ██║╚══██╔══╝"
    echo " ███████║██║     ██║      ██║   ██║██║   ██║██╔██╗ ██║   ██║   "
    echo " ██╔══██║██║     ██║      ██║   ██║██║   ██║██║╚██╗██║   ██║   "
    echo " ██║  ██║╚██████╗╚██████╗ ╚██████╔╝╚██████╔╝██║ ╚████║   ██║   "
    echo " ╚═╝  ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   "
    echo "================================================================"
    echo " Accounting Bot Platform for Telegram & Bale (Iran Standards)  "
    echo " Sanaei-Style One-Click Installer & System Management Script    "
    echo " Repository: https://github.com/meh732/-accountinglearn.git     "
    echo "================================================================"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "Root privileges are recommended for global service configuration."
        if command -v sudo >/dev/null 2>&1; then
            log_info "Sudo will be used for privileged commands."
        else
            log_error "Please run this script as root (sudo bash ...)."
            exit 1
        fi
    fi
}

run_as_root() {
    if [ "$EUID" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

check_dependencies() {
    log_info "Checking required system packages (curl, git, tar, Node.js)..."
    local missing_pkgs=()

    command -v curl >/dev/null 2>&1 || missing_pkgs+=("curl")
    command -v git >/dev/null 2>&1 || missing_pkgs+=("git")
    command -v tar >/dev/null 2>&1 || missing_pkgs+=("tar")

    if [ ${#missing_pkgs[@]} -gt 0 ]; then
        log_warning "Installing base packages: ${missing_pkgs[*]}..."
        if command -v apt-get >/dev/null 2>&1; then
            run_as_root apt-get update -y
            run_as_root apt-get install -y "${missing_pkgs[@]}"
        elif command -v yum >/dev/null 2>&1; then
            run_as_root yum install -y "${missing_pkgs[@]}"
        elif command -v dnf >/dev/null 2>&1; then
            run_as_root dnf install -y "${missing_pkgs[@]}"
        fi
    fi

    # Check / Install Node.js 18+ & npm
    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        log_warning "Node.js not detected. Installing LTS Node.js..."
        if command -v apt-get >/dev/null 2>&1; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | run_as_root bash -
            run_as_root apt-get install -y nodejs
        elif command -v yum >/dev/null 2>&1 || command -v dnf >/dev/null 2>&1; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | run_as_root bash -
            run_as_root yum install -y nodejs || run_as_root dnf install -y nodejs
        fi
    fi

    local node_ver
    node_ver=$(node -v 2>/dev/null || echo "not found")
    log_success "Node.js version: ${node_ver}"
    log_success "npm version: $(npm -v 2>/dev/null || echo 'not found')"
}

# ==============================================================================
# Firewall Configuration
# ==============================================================================
configure_firewall() {
    local target_port="$1"
    if [ -z "${target_port}" ]; then
        return 0
    fi

    log_info "Configuring firewall to allow inbound TCP on Port ${target_port}..."
    
    # 1. UFW (Ubuntu/Debian)
    if command -v ufw >/dev/null 2>&1; then
        run_as_root ufw allow "${target_port}/tcp" >/dev/null 2>&1 || true
        log_success "UFW firewall rule added for Port ${target_port}/tcp."
    fi

    # 2. Firewalld (CentOS/RHEL/Alma/Rocky)
    if command -v firewall-cmd >/dev/null 2>&1; then
        run_as_root firewall-cmd --zone=public --add-port="${target_port}/tcp" --permanent >/dev/null 2>&1 || true
        run_as_root firewall-cmd --reload >/dev/null 2>&1 || true
        log_success "Firewalld rule added for Port ${target_port}/tcp."
    fi

    # 3. Iptables fallback
    if command -v iptables >/dev/null 2>&1; then
        run_as_root iptables -I INPUT -p tcp --dport "${target_port}" -j ACCEPT >/dev/null 2>&1 || true
    fi
}

# ==============================================================================
# Backup Generation & Bot Dispatch
# ==============================================================================
create_and_send_backup() {
    local reason="${1:-Manual}"
    log_info "Preparing system backup (${reason})..."

    mkdir -p "${BACKUP_DIR}"

    if [ -d "${APP_DIR}" ]; then
        tar --exclude="node_modules" \
            --exclude=".git" \
            --exclude="backups" \
            -czf "${BACKUP_FILEPATH}" -C "${APP_DIR}" . 2>/dev/null || true
    fi

    local file_size="0KB"
    if [ -f "${BACKUP_FILEPATH}" ]; then
        file_size=$(du -h "${BACKUP_FILEPATH}" | cut -f1)
        log_success "Backup archive created: ${BACKUP_FILENAME} (${file_size})"
    else
        log_warning "Could not create backup archive (folder empty or not found)."
        return 0
    fi

    # Read credentials from .env if available
    local tg_token=""
    local tg_admin_id=""
    local bale_token=""
    local bale_admin_id=""

    if [ -f "${APP_DIR}/.env" ]; then
        tg_token=$(grep -E "^TELEGRAM_BOT_TOKEN=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
        tg_admin_id=$(grep -E "^(TELEGRAM_ADMIN_CHAT_ID|TELEGRAM_CHANNEL_ID)=" "${APP_DIR}/.env" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
        bale_token=$(grep -E "^BALE_BOT_TOKEN=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
        bale_admin_id=$(grep -E "^(BALE_ADMIN_CHAT_ID|BALE_CHANNEL_ID)=" "${APP_DIR}/.env" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    fi

    # Dispatch to Telegram Bot
    if [ -n "${tg_token}" ] && [ -n "${tg_admin_id}" ]; then
        log_info "Dispatching backup to Telegram Admin (${tg_admin_id})..."
        local caption="📦 *Accounting Bot Platform Backup* (${reason})%0A📅 Date: $(date +"%Y-%m-%d %H:%M:%S")%0A📁 File: ${BACKUP_FILENAME}%0A💾 Size: ${file_size}"
        
        local tg_response
        tg_response=$(curl -s -F "chat_id=${tg_admin_id}" \
            -F "document=@${BACKUP_FILEPATH}" \
            -F "caption=${caption}" \
            -F "parse_mode=Markdown" \
            "https://api.telegram.org/bot${tg_token}/sendDocument" || true)

        if echo "${tg_response}" | grep -q '"ok":true'; then
            log_success "Backup file delivered to Telegram Admin successfully!"
        else
            log_warning "Telegram notification sent (Document upload note: $(echo "${tg_response}" | grep -o '"description":"[^"]*' || echo 'check chat_id/token'))"
        fi
    else
        log_info "Telegram backup skipped (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID not configured in .env)."
    fi

    # Dispatch to Bale Bot
    if [ -n "${bale_token}" ] && [ -n "${bale_admin_id}" ]; then
        log_info "Dispatching backup notice to Bale Bot Admin (${bale_admin_id})..."
        local bale_text="📦 گزارش پشتیبان‌گیری پلتفرم حسابداری ایران (${reason})%0A📅 تاریخ: $(date +"%Y-%m-%d %H:%M:%S")%0A📁 نام فایل: ${BACKUP_FILENAME} (${file_size})"
        
        curl -s -X POST "https://tapi.bale.ai/bot${bale_token}/sendMessage" \
            -H "Content-Type: application/json" \
            -d "{\"chat_id\":\"${bale_admin_id}\",\"text\":\"${bale_text}\"}" >/dev/null 2>&1 || true

        log_success "Backup notification dispatched to Bale Bot successfully!"
    else
        log_info "Bale backup skipped (BALE_BOT_TOKEN / BALE_ADMIN_CHAT_ID not configured in .env)."
    fi

    log_success "Local archive saved at: ${BACKUP_FILEPATH}"
}

# ==============================================================================
# System Backup Restoration (Archive / JSON / Persistent Mirror)
# ==============================================================================
restore_system_backup() {
    print_banner
    check_root
    log_info "Starting System Backup Restoration..."

    echo -e "${CYAN}Choose restoration source:${NC}"
    echo -e " ${GREEN}1)${NC} Restore from persistent storage mirror (data_persistence/)"
    echo -e " ${GREEN}2)${NC} Restore from latest tar.gz archive in backups/"
    echo -e " ${GREEN}3)${NC} Restore from a specific JSON or tar.gz file path"
    echo -e " ${RED}0)${NC} Cancel"
    echo ""
    prompt_user "Select an option [0-3]: " r_choice "1"

    case "$r_choice" in
        1)
            log_info "Restoring from data_persistence/ ..."
            if [ -d "${APP_DIR}/data_persistence" ]; then
                [ -f "${APP_DIR}/data_persistence/bot-config.json" ] && cp -f "${APP_DIR}/data_persistence/bot-config.json" "${APP_DIR}/bot-config.json"
                [ -f "${APP_DIR}/data_persistence/users-quiz-data.json" ] && cp -f "${APP_DIR}/data_persistence/users-quiz-data.json" "${APP_DIR}/users-quiz-data.json"
                [ -f "${APP_DIR}/data_persistence/scheduler-state.json" ] && cp -f "${APP_DIR}/data_persistence/scheduler-state.json" "${APP_DIR}/scheduler-state.json"
                [ -f "${APP_DIR}/data_persistence/.env" ] && cp -f "${APP_DIR}/data_persistence/.env" "${APP_DIR}/.env"
                log_success "All configuration, scheduler state, and users database restored from data_persistence/!"
            else
                log_warning "data_persistence/ folder not found."
            fi
            ;;
        2)
            local latest_tar
            latest_tar=$(ls -t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | head -n1 || true)
            if [ -n "${latest_tar}" ] && [ -f "${latest_tar}" ]; then
                log_info "Found archive: ${latest_tar}"
                tar -xzf "${latest_tar}" -C "${APP_DIR}"
                log_success "Archive extracted and restored successfully!"
            else
                log_error "No backup archive found in ${BACKUP_DIR}."
            fi
            ;;
        3)
            prompt_user "Enter the absolute path to your backup file (.json or .tar.gz): " custom_file ""
            if [ -f "${custom_file}" ]; then
                if [[ "${custom_file}" == *.json ]]; then
                    if grep -q "users" "${custom_file}"; then
                        cp -f "${custom_file}" "${APP_DIR}/users-quiz-data.json"
                        mkdir -p "${APP_DIR}/data_persistence"
                        cp -f "${custom_file}" "${APP_DIR}/data_persistence/users-quiz-data.json"
                        log_success "Restored users quiz database from ${custom_file}!"
                    fi
                elif [[ "${custom_file}" == *.tar.gz ]]; then
                    tar -xzf "${custom_file}" -C "${APP_DIR}"
                    log_success "Archive extracted and restored successfully!"
                fi
            else
                log_error "File not found: ${custom_file}"
            fi
            ;;
        *)
            return 0
            ;;
    esac

    log_info "Restarting service to load restored data..."
    run_as_root systemctl restart "${SERVICE_NAME}" 2>/dev/null || true
    log_success "Restoration process completed!"
}

# ==============================================================================
# Main Administrator & Bot Credentials Configuration
# ==============================================================================
configure_bot_and_admin() {
    echo ""
    echo -e "${YELLOW}${BOLD}================================================================${NC}"
    echo -e "${YELLOW}${BOLD}>> Step 2: Main Administrator & Bot Credentials Configuration${NC}"
    echo -e "${CYAN}Configure your Telegram / Bale Bot and your Main Admin Chat ID.${NC}"
    echo -e "${CYAN}The Main Admin receives automatic database backups, critical${NC}"
    echo -e "${CYAN}server alerts, and possesses exclusive administrative authority.${NC}"
    echo -e "${YELLOW}================================================================${NC}"

    local current_tg_token
    local current_tg_admin
    local current_tg_channel
    local current_bale_token
    local current_bale_admin
    local current_bale_channel

    current_tg_token=$(get_env_val "TELEGRAM_BOT_TOKEN")
    current_tg_admin=$(get_env_val "TELEGRAM_ADMIN_CHAT_ID")
    current_tg_channel=$(get_env_val "TELEGRAM_CHANNEL_ID")
    current_bale_token=$(get_env_val "BALE_BOT_TOKEN")
    current_bale_admin=$(get_env_val "BALE_ADMIN_CHAT_ID")
    current_bale_channel=$(get_env_val "BALE_CHANNEL_ID")

    echo ""
    echo -e "${BLUE}${BOLD}--- [1/2] Telegram Bot & Main Administrator ---${NC}"
    prompt_user "Enter Telegram Bot Token (from @BotFather) [Current: ${current_tg_token:-None}]: " new_tg_token "${current_tg_token}"
    if [ -n "${new_tg_token}" ]; then
        set_env_val "TELEGRAM_BOT_TOKEN" "${new_tg_token}"
        
        echo -e "${CYAN}ℹ️  Tip: You can obtain your numeric Admin ID via Telegram bots @userinfobot or @rawdatabot${NC}"
        prompt_user "Enter Main Admin Telegram Numeric ID (e.g. 123456789) [Current: ${current_tg_admin:-None}]: " new_tg_admin "${current_tg_admin}"
        if [ -n "${new_tg_admin}" ]; then
            set_env_val "TELEGRAM_ADMIN_CHAT_ID" "${new_tg_admin}"
        fi

        prompt_user "Enter Telegram Channel ID or Username (e.g. @hesabdari_channel) [Current: ${current_tg_channel:-None}]: " new_tg_channel "${current_tg_channel}"
        if [ -n "${new_tg_channel}" ]; then
            set_env_val "TELEGRAM_CHANNEL_ID" "${new_tg_channel}"
        fi

        # Immediate verification
        log_info "Verifying Telegram Bot Token with Telegram API..."
        local tg_me
        tg_me=$(curl -s "https://api.telegram.org/bot${new_tg_token}/getMe" || true)
        if echo "${tg_me}" | grep -q '"ok":true'; then
            local bot_user
            bot_user=$(echo "${tg_me}" | grep -o '"username":"[^"]*' | head -n1 | cut -d'"' -f4)
            log_success "Telegram Bot verified online: @${bot_user}"

            if [ -n "${new_tg_admin}" ]; then
                log_info "Sending registration test message to Admin (${new_tg_admin})..."
                local ping_msg="👑 *Accounting Bot Platform — Main Admin Registered*%0A%0AHello! You are now configured as the *Main Administrator* of this accounting bot system.%0A📅 Server Date: $(date +"%Y-%m-%d %H:%M:%S")%0A⚙️ System Port: ${PORT:-3000}%0A%0AAll automated database backups and system notifications will be delivered here."
                curl -s "https://api.telegram.org/bot${new_tg_token}/sendMessage?chat_id=${new_tg_admin}&text=${ping_msg}&parse_mode=Markdown" >/dev/null 2>&1 || true
                log_success "Registration ping delivered to Admin on Telegram!"
            fi
        else
            log_warning "Could not reach Telegram API (check token validity or server network)."
        fi
    else
        log_info "Telegram Bot configuration skipped."
    fi

    echo ""
    echo -e "${BLUE}${BOLD}--- [2/2] Bale Messenger Bot & Admin (Optional) ---${NC}"
    prompt_user "Enter Bale Bot Token (optional, press Enter to skip) [Current: ${current_bale_token:-None}]: " new_bale_token "${current_bale_token}"
    if [ -n "${new_bale_token}" ]; then
        set_env_val "BALE_BOT_TOKEN" "${new_bale_token}"
        prompt_user "Enter Bale Admin Chat ID (optional) [Current: ${current_bale_admin:-None}]: " new_bale_admin "${current_bale_admin}"
        if [ -n "${new_bale_admin}" ]; then
            set_env_val "BALE_ADMIN_CHAT_ID" "${new_bale_admin}"
        fi
        prompt_user "Enter Bale Channel ID (e.g. @hesabdari_bale) [Current: ${current_bale_channel:-None}]: " new_bale_channel "${current_bale_channel}"
        if [ -n "${new_bale_channel}" ]; then
            set_env_val "BALE_CHANNEL_ID" "${new_bale_channel}"
        fi
    fi

    log_success "Administrator and Bot credentials saved to .env."
    # Also synchronize to bot-config.json
    node -e "
const fs = require('fs');
const p = '${APP_DIR}/bot-config.json';
let cfg = {};
try { if (fs.existsSync(p)) cfg = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
if ('${new_tg_token}') cfg.telegramToken = '${new_tg_token}';
if ('${new_tg_channel}') cfg.telegramChannel = '${new_tg_channel}';
if ('${new_tg_admin}') cfg.telegramAdminChatId = '${new_tg_admin}';
if ('${new_bale_token}') cfg.baleToken = '${new_bale_token}';
if ('${new_bale_channel}') cfg.baleChannel = '${new_bale_channel}';
if ('${new_bale_admin}') cfg.baleAdminChatId = '${new_bale_admin}';
fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
" 2>/dev/null || true

    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        log_info "Restarting ${SERVICE_NAME} to apply updated credentials..."
        systemctl restart "${SERVICE_NAME}" || true
        log_success "Service restarted successfully."
    fi
}

# ==============================================================================
# Installation
# ==============================================================================
do_install() {
    print_banner
    check_root
    log_info "Starting installation of Accounting Bot Platform..."
    check_dependencies

    # Clone or verify repository location
    if [ ! -f "$(pwd)/package.json" ]; then
        log_info "Setting up application directory at ${INSTALL_DIR}..."
        run_as_root mkdir -p "${INSTALL_DIR}"
        if [ -d "${INSTALL_DIR}/.git" ]; then
            log_info "Existing repository found in ${INSTALL_DIR}, pulling updates..."
            cd "${INSTALL_DIR}"
            git pull || true
        else
            log_info "Cloning repository from ${REPO_URL}..."
            run_as_root git clone "${REPO_URL}" "${INSTALL_DIR}"
            cd "${INSTALL_DIR}"
        fi
        APP_DIR="${INSTALL_DIR}"
    else
        APP_DIR="$(pwd)"
        cd "${APP_DIR}"
    fi

    # Setup environment file
    if [ ! -f "${APP_DIR}/.env" ]; then
        if [ -f "${APP_DIR}/.env.example" ]; then
            log_info "Initializing .env configuration from template..."
            cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
        else
            touch "${APP_DIR}/.env"
        fi
    fi

    # 1. Custom Port Selection
    local default_port="3000"
    if [ -z "${CLI_PORT}" ]; then
        echo ""
        echo -e "${YELLOW}${BOLD}================================================================${NC}"
        echo -e "${YELLOW}${BOLD}>> Step 1: Web Panel Port Configuration${NC}"
        echo -e "${CYAN}You can specify any custom port (e.g. 80, 8080, 5000, 8585, 3000).${NC}"
        echo -e "${YELLOW}================================================================${NC}"
        prompt_user "Enter web panel port [Default: ${default_port}]: " custom_port "${default_port}"

        while ! [[ "${custom_port}" =~ ^[0-9]+$ ]] || [ "${custom_port}" -lt 1 ] || [ "${custom_port}" -gt 65535 ]; do
            echo -e "${RED}Invalid port! Port number must be between 1 and 65535.${NC}"
            prompt_user "Please enter port again [Default: ${default_port}]: " custom_port "${default_port}"
        done
        PORT="${custom_port}"
    else
        PORT="${CLI_PORT}"
        log_info "Using custom port specified via CLI/Environment: ${PORT}"
    fi

    # Save Port to .env file
    if [ -f "${APP_DIR}/.env" ]; then
        if grep -q "^PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^PORT=.*/PORT=${PORT}/" "${APP_DIR}/.env"
        else
            echo "PORT=${PORT}" >> "${APP_DIR}/.env"
        fi
        if grep -q "^APP_PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^APP_PORT=.*/APP_PORT=${PORT}/" "${APP_DIR}/.env"
        else
            echo "APP_PORT=${PORT}" >> "${APP_DIR}/.env"
        fi
        if grep -q "^CUSTOM_PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^CUSTOM_PORT=.*/CUSTOM_PORT=${PORT}/" "${APP_DIR}/.env"
        else
            echo "CUSTOM_PORT=${PORT}" >> "${APP_DIR}/.env"
        fi
    fi

    # 2. Main Administrator & Bot Configuration
    if [ -n "${CLI_ADMIN_ID}" ] || [ -n "${CLI_BOT_TOKEN}" ]; then
        [ -n "${CLI_BOT_TOKEN}" ] && set_env_val "TELEGRAM_BOT_TOKEN" "${CLI_BOT_TOKEN}"
        [ -n "${CLI_ADMIN_ID}" ] && set_env_val "TELEGRAM_ADMIN_CHAT_ID" "${CLI_ADMIN_ID}"
        [ -n "${CLI_CHANNEL}" ] && set_env_val "TELEGRAM_CHANNEL_ID" "${CLI_CHANNEL}"
        log_success "Admin & Bot credentials configured via CLI flags."
    else
        configure_bot_and_admin
    fi

    # Install npm dependencies
    log_info "Installing npm dependencies (may take a minute)..."
    npm install

    # Build production bundle
    log_info "Building web panel and API bundle..."
    npm run build

    # Create CLI shortcut in /usr/local/bin/accountinglearn
    log_info "Creating global CLI command (accountinglearn & acc-bot)..."
    run_as_root chmod +x "${APP_DIR}/install.sh"
    run_as_root ln -sf "${APP_DIR}/install.sh" "${BIN_LINK}"
    run_as_root ln -sf "${APP_DIR}/install.sh" "${BIN_LINK_SHORT}"

    # Systemd Service Configuration
    log_info "Configuring systemd service (${SERVICE_NAME}.service) on Custom Port ${PORT}..."
    local run_user
    run_user=$(whoami)
    local node_path
    node_path=$(command -v node)

    local service_content="[Unit]
Description=Accounting Bot Platform for Telegram and Bale (Iran)
After=network.target

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs --port ${PORT}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=APP_PORT=${PORT}
Environment=CUSTOM_PORT=${PORT}

[Install]
WantedBy=multi-user.target
"

    echo "${service_content}" | run_as_root tee "${SERVICE_FILE}" >/dev/null
    run_as_root systemctl daemon-reload
    run_as_root systemctl enable "${SERVICE_NAME}"
    run_as_root systemctl restart "${SERVICE_NAME}"

    # Automatically open the chosen port in firewall
    configure_firewall "${PORT}"

    # Optional Domain & SSL Configuration
    if [ -n "${CLI_DOMAIN}" ] || [ "${CLI_SSL}" = "1" ]; then
        setup_domain_and_ssl "${PORT}" "${CLI_DOMAIN}" "${CLI_SSL}" "${CLI_EMAIL}"
    else
        echo ""
        echo -e "${YELLOW}>> Domain & SSL Configuration (Optional):${NC}"
        prompt_user "Do you want to configure a custom domain and optional SSL (Let's Encrypt)? [y/N]: " setup_domain_choice "N"
        if [[ "$setup_domain_choice" =~ ^[Yy]$ ]]; then
            setup_domain_and_ssl "${PORT}"
        fi
    fi

    # Fetch Server IP
    local server_ip
    server_ip=$(curl -s -4 icanhazip.com || curl -s -4 ifconfig.me || echo "SERVER_IP")

    echo -e "${GREEN}${BOLD}"
    echo "=================================================================="
    echo "  🎉 INSTALLATION COMPLETED SUCCESSFULLY!                         "
    echo "=================================================================="
    echo -e "  Web Panel Port  : ${YELLOW}${PORT}${GREEN}"
    echo -e "  Web Panel URL   : ${CYAN}http://${server_ip}:${PORT}${GREEN}"
    echo -e "  Local URL       : ${CYAN}http://localhost:${PORT}${GREEN}"
    echo -e "  Service Name    : ${CYAN}${SERVICE_NAME}${GREEN}"
    echo -e "  Management CLI  : ${YELLOW}accountinglearn${GREEN} or ${YELLOW}acc-bot${GREEN}"
    echo "=================================================================="
    echo -e "  Simply type ${YELLOW}accountinglearn${GREEN} anywhere in your terminal to   "
    echo -e "  manage your service, change port, or configure domain & SSL!   "
    echo "=================================================================="
    echo -e "${NC}"
}

# ==============================================================================
# Update
# ==============================================================================
do_update() {
    print_banner
    check_root
    log_info "Starting update process..."
    check_dependencies

    cd "${APP_DIR}"

    # 1. Automatic Backup before update & send to bots
    create_and_send_backup "Pre-Update"

    # 2. Pull Git updates if repo exists
    if [ -d "${APP_DIR}/.git" ]; then
        log_info "Pulling latest code from GitHub..."
        # Backup user config files safely
        cp -f "${APP_DIR}/.env" "${APP_DIR}/.env.bak" 2>/dev/null || true
        cp -f "${APP_DIR}/bot-config.json" "${APP_DIR}/bot-config.json.bak" 2>/dev/null || true
        cp -f "${APP_DIR}/users-quiz-data.json" "${APP_DIR}/users-quiz-data.json.bak" 2>/dev/null || true
        cp -f "${APP_DIR}/scheduler-state.json" "${APP_DIR}/scheduler-state.json.bak" 2>/dev/null || true

        # Mirror to data_persistence before pulling updates
        mkdir -p "${APP_DIR}/data_persistence" 2>/dev/null || true
        [ -f "${APP_DIR}/users-quiz-data.json" ] && cp -f "${APP_DIR}/users-quiz-data.json" "${APP_DIR}/data_persistence/users-quiz-data.json" 2>/dev/null || true
        [ -f "${APP_DIR}/bot-config.json" ] && cp -f "${APP_DIR}/bot-config.json" "${APP_DIR}/data_persistence/bot-config.json" 2>/dev/null || true
        [ -f "${APP_DIR}/scheduler-state.json" ] && cp -f "${APP_DIR}/scheduler-state.json" "${APP_DIR}/data_persistence/scheduler-state.json" 2>/dev/null || true
        [ -f "${APP_DIR}/.env" ] && cp -f "${APP_DIR}/.env" "${APP_DIR}/data_persistence/.env" 2>/dev/null || true

        git stash 2>/dev/null || true
        git pull origin main || git pull origin master || git pull || true
        git stash pop 2>/dev/null || true

        # Restore user configs and databases
        [ -f "${APP_DIR}/.env.bak" ] && cp -f "${APP_DIR}/.env.bak" "${APP_DIR}/.env"
        [ -f "${APP_DIR}/bot-config.json.bak" ] && cp -f "${APP_DIR}/bot-config.json.bak" "${APP_DIR}/bot-config.json"
        [ -f "${APP_DIR}/users-quiz-data.json.bak" ] && cp -f "${APP_DIR}/users-quiz-data.json.bak" "${APP_DIR}/users-quiz-data.json"
        [ -f "${APP_DIR}/scheduler-state.json.bak" ] && cp -f "${APP_DIR}/scheduler-state.json.bak" "${APP_DIR}/scheduler-state.json"

        # Auto-recover from data_persistence if any file is missing
        [ ! -f "${APP_DIR}/users-quiz-data.json" ] && [ -f "${APP_DIR}/data_persistence/users-quiz-data.json" ] && cp -f "${APP_DIR}/data_persistence/users-quiz-data.json" "${APP_DIR}/users-quiz-data.json"
        [ ! -f "${APP_DIR}/bot-config.json" ] && [ -f "${APP_DIR}/data_persistence/bot-config.json" ] && cp -f "${APP_DIR}/data_persistence/bot-config.json" "${APP_DIR}/bot-config.json"
        [ ! -f "${APP_DIR}/scheduler-state.json" ] && [ -f "${APP_DIR}/data_persistence/scheduler-state.json" ] && cp -f "${APP_DIR}/data_persistence/scheduler-state.json" "${APP_DIR}/scheduler-state.json"

        rm -f "${APP_DIR}/.env.bak" "${APP_DIR}/bot-config.json.bak" "${APP_DIR}/users-quiz-data.json.bak" "${APP_DIR}/scheduler-state.json.bak"
    else
        log_info "Cloning latest release..."
        run_as_root git clone "${REPO_URL}" "${INSTALL_DIR}_tmp"
        cp -r "${INSTALL_DIR}_tmp/"* "${APP_DIR}/" 2>/dev/null || true
        rm -rf "${INSTALL_DIR}_tmp"
    fi

    # 3. Update dependencies & rebuild
    log_info "Updating dependencies..."
    npm install

    log_info "Rebuilding application..."
    npm run build

    # Ensure CLI shortcuts
    run_as_root chmod +x "${APP_DIR}/install.sh"
    run_as_root ln -sf "${APP_DIR}/install.sh" "${BIN_LINK}"
    run_as_root ln -sf "${APP_DIR}/install.sh" "${BIN_LINK_SHORT}"

    # 4. Restart service
    log_info "Restarting ${SERVICE_NAME} service..."
    run_as_root systemctl daemon-reload
    run_as_root systemctl restart "${SERVICE_NAME}"

    log_success "Update finished! Backup was automatically archived & dispatched to your bots."
}

# ==============================================================================
# Uninstall
# ==============================================================================
do_uninstall() {
    print_banner
    check_root
    log_warning "You are about to UNINSTALL the Accounting Bot Platform."
    read -p "Are you sure you want to proceed? [y/N]: " -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Uninstallation canceled."
        exit 0
    fi

    # 1. Automatic Final Backup before uninstall & send to bots
    create_and_send_backup "Pre-Uninstall"

    # 2. Stop and disable systemd service
    log_info "Stopping and removing ${SERVICE_NAME} systemd service..."
    run_as_root systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
    run_as_root systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    run_as_root rm -f "${SERVICE_FILE}"
    run_as_root systemctl daemon-reload

    # 3. Remove CLI symlinks
    run_as_root rm -f "${BIN_LINK}" "${BIN_LINK_SHORT}"

    log_success "Service and CLI commands removed."

    read -p "Do you also want to remove application files (saved backups in ${BACKUP_DIR} will be preserved)? [y/N]: " -r rm_files
    if [[ "$rm_files" =~ ^[Yy]$ ]]; then
        log_info "Cleaning up application files..."
        run_as_root rm -rf "${APP_DIR}/dist" "${APP_DIR}/node_modules"
        log_success "Application files cleaned. All backups remain safely preserved in: ${BACKUP_DIR}"
    fi

    echo -e "${GREEN}${BOLD}"
    echo "=================================================================="
    echo "  UNINSTALLATION COMPLETE!                                        "
    echo "  Your final backup was sent to your Telegram & Bale bots.        "
    echo "=================================================================="
    echo -e "${NC}"
}

# ==============================================================================
# Service Controls
# ==============================================================================
start_service() {
    log_info "Starting ${SERVICE_NAME}..."
    run_as_root systemctl start "${SERVICE_NAME}"
    do_status
}

stop_service() {
    log_info "Stopping ${SERVICE_NAME}..."
    run_as_root systemctl stop "${SERVICE_NAME}"
    do_status
}

restart_service() {
    log_info "Restarting ${SERVICE_NAME}..."
    run_as_root systemctl restart "${SERVICE_NAME}"
    do_status
}

enable_service() {
    log_info "Enabling ${SERVICE_NAME} on boot..."
    run_as_root systemctl enable "${SERVICE_NAME}"
    log_success "Enabled on boot."
}

disable_service() {
    log_info "Disabling ${SERVICE_NAME} on boot..."
    run_as_root systemctl disable "${SERVICE_NAME}"
    log_success "Disabled on boot."
}

do_status() {
    print_banner
    local current_port="3000"
    if [ -f "${SERVICE_FILE}" ]; then
        current_port=$(grep "\-\-port" "${SERVICE_FILE}" | awk -F'--port ' '{print $2}' | tr -d ' ' || echo "3000")
        if [ -z "$current_port" ]; then
            current_port=$(grep "CUSTOM_PORT=" "${SERVICE_FILE}" | cut -d'=' -f2 || echo "3000")
        fi
    fi
    current_port="${current_port:-3000}"

    local server_ip
    server_ip=$(curl -s -4 icanhazip.com || curl -s -4 ifconfig.me || echo "SERVER_IP")
    local tg_admin
    local tg_token
    local tg_channel
    local bale_admin
    local bale_token

    tg_admin=$(get_env_val "TELEGRAM_ADMIN_CHAT_ID")
    tg_token=$(get_env_val "TELEGRAM_BOT_TOKEN")
    tg_channel=$(get_env_val "TELEGRAM_CHANNEL_ID")
    bale_admin=$(get_env_val "BALE_ADMIN_CHAT_ID")
    bale_token=$(get_env_val "BALE_BOT_TOKEN")

    echo -e "${CYAN}${BOLD}=== 📊 Platform & Administrator Status ===${NC}"
    echo -e " 🌐 Web Panel URL:          ${CYAN}http://${server_ip}:${current_port}${NC}"
    echo -e " 💻 Local Address:          ${CYAN}http://localhost:${current_port}${NC}"
    echo -e " 👑 Main Telegram Admin ID: ${YELLOW}${tg_admin:-Not Configured}${NC}"
    if [ -n "${tg_token}" ]; then
        echo -e " 🤖 Telegram Bot Token:     ${GREEN}Configured (${tg_token:0:8}...)${NC}"
    else
        echo -e " 🤖 Telegram Bot Token:     ${RED}Not Configured${NC}"
    fi
    if [ -n "${tg_channel}" ]; then
        echo -e " 📢 Telegram Channel:       ${CYAN}${tg_channel}${NC}"
    fi
    if [ -n "${bale_admin}" ]; then
        echo -e " 💬 Bale Admin Chat ID:     ${YELLOW}${bale_admin}${NC}"
    fi
    echo "------------------------------------------------------------------"
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo -e "${GREEN}${BOLD}● ${SERVICE_NAME} is RUNNING${NC}"
        run_as_root systemctl status "${SERVICE_NAME}" --no-pager -l
    else
        echo -e "${RED}${BOLD}○ ${SERVICE_NAME} is NOT RUNNING${NC}"
        run_as_root systemctl status "${SERVICE_NAME}" --no-pager -l 2>/dev/null || true
    fi
    echo ""
    read -p "Press Enter to return to menu..." -r
}

manage_scheduler_cli() {
    print_banner
    echo -e "${CYAN}${BOLD}=== ⚡ 24/7 Auto-Pilot Background Scheduler Engine ===${NC}"
    echo ""
    local current_port="3000"
    if [ -f "${SERVICE_FILE}" ]; then
        current_port=$(grep "\-\-port" "${SERVICE_FILE}" | awk -F'--port ' '{print $2}' | tr -d ' ' || echo "3000")
    fi
    current_port="${current_port:-3000}"

    local status_json
    status_json=$(curl -s -m 5 "http://127.0.0.1:${current_port}/api/scheduler/status" 2>/dev/null || echo "")

    if echo "$status_json" | grep -q '"ok":true'; then
        echo -e " ${GREEN}● Auto-Pilot Scheduler API Connected${NC}"
        echo -e " ${status_json}" | grep -o '"tehranTimeNow":"[^"]*"' | sed 's/"//g' | sed 's/tehranTimeNow:/ Tehran Time: /' || true
        echo -e " ${status_json}" | grep -o '"currentDayNumber":[0-9]*' | sed 's/currentDayNumber:/ Course Day: Day /' || true
        local tg_conn=$(echo "$status_json" | grep -o '"hasTelegramToken":true' || true)
        local tg_ch=$(echo "$status_json" | grep -o '"hasTelegramChannel":true' || true)
        if [ -n "$tg_conn" ] && [ -n "$tg_ch" ]; then
            echo -e " ✈️  Telegram Channel: ${GREEN}Configured${NC}"
        else
            echo -e " ✈️  Telegram Channel: ${YELLOW}Not fully configured (Check menu option 18)${NC}"
        fi
    else
        echo -e " ${YELLOW}⚠️ Backend service is not responding or running an older build without the Auto-Pilot scheduler endpoints.${NC}"
        echo -e " ${CYAN}👉 Run option 19 in the main menu (Rebuild & Restart) to activate the latest code.${NC}"
    fi

    echo ""
    echo "Options:"
    echo -e " 1) Force Trigger Morning Post (09:00 - Theory Lesson) Now"
    echo -e " 2) Force Trigger Noon Post (14:30 - Workshop/News) Now"
    echo -e " 3) Force Trigger Evening Post (20:00 - Quiz Test) Now"
    echo -e " 4) Force Trigger Late-Night Post (22:30 - Fun & Memes) Now"
    echo -e " 5) 🔍 Run Comprehensive Telegram & Channel Diagnostics"
    echo -e " 0) Back to main menu"
    echo ""
    prompt_user "Select option [0-5]: " sched_choice "0"

    case "$sched_choice" in
        1|2|3|4)
            local slot_name="morning"
            [ "$sched_choice" = "2" ] && slot_name="noon"
            [ "$sched_choice" = "3" ] && slot_name="evening"
            [ "$sched_choice" = "4" ] && slot_name="late_night"

            log_info "Triggering ${slot_name} Post via API..."
            local raw_res
            raw_res=$(curl -s -m 20 -X POST "http://127.0.0.1:${current_port}/api/scheduler/trigger-now" \
                -H "Content-Type: application/json" \
                -d "{\"slot\":\"${slot_name}\"}" 2>&1 || echo "curl_failed")

            if [ "$raw_res" = "curl_failed" ] || [ -z "$raw_res" ]; then
                log_error "Failed to connect to backend service on port ${current_port}."
                echo -e "${YELLOW}👉 Make sure the service is running: systemctl status ${SERVICE_NAME}${NC}"
            elif echo "$raw_res" | grep -q '"ok":true'; then
                log_success "${slot_name} trigger executed by backend engine!"
                echo ""
                local post_title
                post_title=$(echo "$raw_res" | grep -o '"title":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "Post")
                echo -e "   📌 Title: ${CYAN}${post_title}${NC}"

                # Parse Telegram status
                if echo "$raw_res" | grep -q '"telegramStatus":{[^}]*"ok":true'; then
                    local is_sim=$(echo "$raw_res" | grep -o '"telegramStatus":{[^}]*"simulated":true' || true)
                    if [ -n "$is_sim" ]; then
                        echo -e "   ✈️  Telegram: ${YELLOW}⚠️ Simulated Mode (Token or Channel not set in .env)${NC}"
                    else
                        local msg_id
                        msg_id=$(echo "$raw_res" | grep -o '"telegramStatus":{[^}]*"messageId":[0-9]*' | grep -o '[0-9]*$' || echo "OK")
                        echo -e "   ✈️  Telegram: ${GREEN}✅ Sent Successfully to Channel (Message ID: ${msg_id})${NC}"
                    fi
                else
                    local tg_err
                    tg_err=$(echo "$raw_res" | grep -o '"telegramStatus":{[^}]*"error":"[^"]*' | head -n1 | cut -d'"' -f6 || echo "Unknown error")
                    echo -e "   ✈️  Telegram: ${RED}❌ Error: ${tg_err}${NC}"
                    echo -e "       ${YELLOW}👉 Run option 18 (Diagnostics) to test permissions and auto-fix!${NC}"
                fi

                # Parse Bale status
                if echo "$raw_res" | grep -q '"baleStatus":{[^}]*"ok":true'; then
                    local is_bale_sim=$(echo "$raw_res" | grep -o '"baleStatus":{[^}]*"simulated":true' || true)
                    if [ -z "$is_bale_sim" ]; then
                        echo -e "   🌀 Bale: ${GREEN}✅ Sent Successfully to Channel${NC}"
                    fi
                else
                    local bale_err
                    bale_err=$(echo "$raw_res" | grep -o '"baleStatus":{[^}]*"error":"[^"]*' | head -n1 | cut -d'"' -f6 || echo "")
                    if [ -n "$bale_err" ]; then
                        echo -e "   🌀 Bale: ${RED}❌ Error: ${bale_err}${NC}"
                    fi
                fi
            else
                log_error "Server returned error response:"
                echo -e "${RED}${raw_res}${NC}"
                if echo "$raw_res" | grep -q "Cannot POST /api/scheduler/trigger-now"; then
                    echo ""
                    echo -e "${YELLOW}🚨 ROOT CAUSE: The running server process has NOT been rebuilt with the new features!${NC}"
                    echo -e "   Run Option 19 in the main menu or run:"
                    echo -e "   ${CYAN}cd ${APP_DIR} && npm run build && systemctl restart ${SERVICE_NAME}${NC}"
                fi
            fi
            ;;
        5)
            diagnose_telegram_and_channel
            return
            ;;
        *)
            ;;
    esac
    read -p "Press Enter to return to menu..." -r
}

diagnose_telegram_and_channel() {
    print_banner
    echo -e "${CYAN}${BOLD}=== 🔍 Comprehensive Telegram & Bale Diagnostics ===${NC}"
    echo -e "${CYAN}This tool checks Telegram API connectivity, validates your bot token,${NC}"
    echo -e "${CYAN}checks channel permissions, and registers the Telegram Bot Menu.${NC}"
    echo "=================================================================="
    echo ""

    local tg_token=""
    local tg_channel=""
    local tg_admin=""
    local bale_token=""
    local bale_channel=""

    # Read from .env first
    if [ -f "${APP_DIR}/.env" ]; then
        tg_token=$(grep -E "^TELEGRAM_BOT_TOKEN=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
        tg_channel=$(grep -E "^TELEGRAM_CHANNEL_ID=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
        tg_admin=$(grep -E "^TELEGRAM_ADMIN_CHAT_ID=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
        bale_token=$(grep -E "^BALE_BOT_TOKEN=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
        bale_channel=$(grep -E "^BALE_CHANNEL_ID=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
    fi

    # Fallback from bot-config.json
    if [ -z "$tg_token" ] && [ -f "${APP_DIR}/bot-config.json" ]; then
        tg_token=$(grep -o '"telegramToken":"[^"]*' "${APP_DIR}/bot-config.json" | head -n1 | cut -d'"' -f4 || true)
    fi
    if [ -z "$tg_channel" ] && [ -f "${APP_DIR}/bot-config.json" ]; then
        tg_channel=$(grep -o '"telegramChannel":"[^"]*' "${APP_DIR}/bot-config.json" | head -n1 | cut -d'"' -f4 || true)
    fi

    local tg_masked="Not Set"
    if [ -n "$tg_token" ]; then
        tg_masked="${tg_token:0:10}****************"
    fi

    echo -e "📋 Current Configuration in .env / bot-config.json:"
    echo -e "   • Telegram Bot Token:  ${CYAN}${tg_masked}${NC}"
    echo -e "   • Telegram Channel:    ${CYAN}${tg_channel:-Not Set}${NC}"
    echo -e "   • Telegram Admin ID:   ${CYAN}${tg_admin:-Not Set}${NC}"
    echo -e "   • Bale Channel:        ${CYAN}${bale_channel:-Not Set}${NC}"
    echo ""

    # 1. Test Network Connectivity to api.telegram.org
    echo -e "1. Testing Server Network Connectivity to api.telegram.org..."
    local http_probe
    http_probe=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "https://api.telegram.org" 2>/dev/null || echo "000")
    if [ "$http_probe" != "000" ]; then
        echo -e "   ${GREEN}● Outbound connectivity to Telegram API: OK (HTTP ${http_probe})${NC}"
    else
        echo -e "   ${RED}❌ Could not connect to https://api.telegram.org!${NC}"
        echo -e "   ${YELLOW}👉 Reason: Outbound connection to api.telegram.org is blocked or timed out.${NC}"
        echo -e "      If your VPS is in Iran, Telegram API is filtered by national firewalls."
        echo -e "      Make sure your VPS has open international internet access.${NC}"
        echo ""
    fi

    # 2. Test Bot Token via getMe
    echo -e "2. Testing Telegram Bot Token (getMe)..."
    if [ -z "$tg_token" ]; then
        echo -e "   ${RED}❌ TELEGRAM_BOT_TOKEN is not configured!${NC}"
        echo -e "   👉 Choose option 8 in the main menu to enter your bot token from @BotFather."
    else
        local me_json
        me_json=$(curl -s -m 10 "https://api.telegram.org/bot${tg_token}/getMe" 2>&1 || echo "")
        if echo "$me_json" | grep -q '"ok":true'; then
            local bot_id
            bot_id=$(echo "$me_json" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)
            local bot_name
            bot_name=$(echo "$me_json" | grep -o '"first_name":"[^"]*' | head -n1 | cut -d'"' -f4)
            local bot_username
            bot_username=$(echo "$me_json" | grep -o '"username":"[^"]*' | head -n1 | cut -d'"' -f4)
            echo -e "   ${GREEN}● Bot Token is VALID and ACTIVE!${NC}"
            echo -e "     Name:     ${CYAN}${bot_name}${NC}"
            echo -e "     Username: ${CYAN}@${bot_username}${NC}"
            echo -e "     Bot ID:   ${CYAN}${bot_id}${NC}"

            # 3. Force-register Bot Commands and Chat Menu Button
            echo ""
            echo -e "3. Force-Registering Telegram Bot Menu & Inline Commands..."
            # Clear conflicting webhooks
            curl -s -m 8 "https://api.telegram.org/bot${tg_token}/deleteWebhook?drop_pending_updates=false" >/dev/null 2>&1 || true
            
            # Register Bot Commands
            local cmd_payload='{"commands":[{"command":"start","description":"🏠 منوی اصلی و شروع ربات"},{"command":"quiz","description":"📝 آزمون تستی روز جاری"},{"command":"bank","description":"📚 بانک ۹۰ آزمون دوره"},{"command":"karname","description":"🏆 کارنامه، امتیاز و رتبه من"},{"command":"rank","description":"🥇 جدول نخبگان"},{"command":"lesson","description":"📖 درس و سرفصل آموزشی امروز"},{"command":"help","description":"❓ راهنما و پشتیبانی"}]}'
            local cmd_res
            cmd_res=$(curl -s -m 10 -X POST "https://api.telegram.org/bot${tg_token}/setMyCommands" \
                -H "Content-Type: application/json" \
                -d "${cmd_payload}" 2>&1 || echo "")

            # Register Menu Button in chat bar
            local btn_res
            btn_res=$(curl -s -m 10 -X POST "https://api.telegram.org/bot${tg_token}/setChatMenuButton" \
                -H "Content-Type: application/json" \
                -d '{"menu_button":{"type":"commands"}}' 2>&1 || echo "")

            if echo "$cmd_res" | grep -q '"ok":true'; then
                echo -e "   ${GREEN}● Bot Menu Commands (/start, /quiz, /bank, /karname, /rank, /lesson) registered!${NC}"
                echo -e "   ${GREEN}● Chat Menu Button activated on Telegram!${NC}"
                echo -e "   👉 Users can now open @${bot_username} in Telegram and see the Menu button."
            else
                echo -e "   ${YELLOW}⚠️ Menu registration response: ${cmd_res}${NC}"
            fi

            # 4. Test Channel Configuration & Permissions
            echo ""
            echo -e "4. Checking Channel Configuration (${tg_channel:-Not Set})..."
            if [ -z "$tg_channel" ]; then
                echo -e "   ${RED}❌ TELEGRAM_CHANNEL_ID is not configured!${NC}"
                echo -e "   👉 Choose option 8 in the main menu to enter your channel (e.g. @mychannel or -100...).${NC}"
            else
                local probe_ch="$tg_channel"
                probe_ch=$(echo "$probe_ch" | sed 's|https://t.me/||g' | sed 's|t.me/||g' | tr -d '/')
                if [[ ! "$probe_ch" =~ ^@ ]] && [[ ! "$probe_ch" =~ ^- ]]; then
                    probe_ch="@${probe_ch}"
                fi

                local chat_json
                chat_json=$(curl -s -m 10 "https://api.telegram.org/bot${tg_token}/getChat?chat_id=${probe_ch}" 2>&1 || echo "")
                if echo "$chat_json" | grep -q '"ok":true'; then
                    local ch_title
                    ch_title=$(echo "$chat_json" | grep -o '"title":"[^"]*' | head -n1 | cut -d'"' -f4)
                    local ch_type
                    ch_type=$(echo "$chat_json" | grep -o '"type":"[^"]*' | head -n1 | cut -d'"' -f4)
                    local ch_id
                    ch_id=$(echo "$chat_json" | grep -o '"id":-[0-9]*' | head -n1 | cut -d':' -f2)
                    echo -e "   ${GREEN}● Channel Found by Telegram!${NC}"
                    echo -e "     Title: ${CYAN}${ch_title}${NC}"
                    echo -e "     Type:  ${CYAN}${ch_type}${NC}"
                    echo -e "     ID:    ${CYAN}${ch_id}${NC}"

                    # 5. Check if Bot is an Administrator with Post Rights
                    echo ""
                    echo -e "5. Checking Bot Administrator Status in Channel..."
                    local admins_json
                    admins_json=$(curl -s -m 10 "https://api.telegram.org/bot${tg_token}/getChatMember?chat_id=${probe_ch}&user_id=${bot_id}" 2>&1 || echo "")
                    if echo "$admins_json" | grep -q '"status":"administrator"'; then
                        echo -e "   ${GREEN}● Bot is an ADMINISTRATOR in the channel!${NC}"
                        if echo "$admins_json" | grep -q '"can_post_messages":false'; then
                            echo -e "   ${RED}❌ Warning: Bot is admin, BUT 'can_post_messages' is set to FALSE!${NC}"
                            echo -e "   ${YELLOW}👉 Go to channel settings -> Administrators -> @${bot_username} -> enable 'Post Messages'.${NC}"
                        else
                            echo -e "   ${GREEN}● Permission: can_post_messages = TRUE (Authorized to post)${NC}"
                        fi
                    elif echo "$admins_json" | grep -q '"status":"creator"'; then
                        echo -e "   ${GREEN}● Bot is the CREATOR/OWNER of the channel! Full privileges.${NC}"
                    else
                        echo -e "   ${RED}❌ BOT IS NOT AN ADMINISTRATOR IN THIS CHANNEL!${NC}"
                        echo -e "   ${YELLOW}════════════════════════════════════════════════════════════════${NC}"
                        echo -e "   ${YELLOW}👉 HOW TO FIX (THIS IS WHY YOUR BOT CANNOT POST TO THE CHANNEL):${NC}"
                        echo -e "      1. Open Telegram on your phone or desktop."
                        echo -e "      2. Go to your channel (${probe_ch})."
                        echo -e "      3. Click Channel Profile -> Edit (icon مداد) -> Administrators (مدیران)."
                        echo -e "      4. Tap 'Add Administrator' (افزودن مدیر)."
                        echo -e "      5. Search for: ${CYAN}@${bot_username}${NC}"
                        echo -e "      6. Make sure the toggle ${BOLD}'Post Messages' (ارسال پیام)${NC} is ENABLED."
                        echo -e "      7. Click Save / Done."
                        echo -e "   ${YELLOW}════════════════════════════════════════════════════════════════${NC}"
                    fi

                    # 6. Direct Message Test to Admin
                    if [ -n "$tg_admin" ]; then
                        echo ""
                        echo -e "6. Testing Direct Private Chat with Admin ID (${CYAN}${tg_admin}${NC})..."
                        local dm_text="👋 <b>سلام ادمین گرامی!</b>%0A%0A✅ ارتباط مستقیم دوطرفه ربات با حساب شما برقرار است.%0A🚀 برای کار با ربات، در همین چت روی دستور /start بزنید تا منوی دکمه‌ای فعال شود."
                        local dm_payload="{\"chat_id\":\"${tg_admin}\",\"text\":\"${dm_text}\",\"parse_mode\":\"HTML\",\"reply_markup\":{\"keyboard\":[[{\"text\":\"📝 آزمون تستی امروز\"},{\"text\":\"📚 بانک ۹۰ آزمون دوره\"}],[{\"text\":\"🏆 کارنامه و رتبه من\"},{\"text\":\"📖 درس و آموزش امروز\"}],[{\"text\":\"👑 پنل مدیریت ادمین ⚙️\"},{\"text\":\"📦 دریافت آنی بکاپ 💾\"}],[{\"text\":\"🏠 منوی اصلی ربات\"},{\"text\":\"❓ راهنما و پشتیبانی\"}]],\"resize_keyboard\":true,\"is_persistent\":true}}"
                        local dm_res
                        dm_res=$(curl -s -m 15 -X POST "https://api.telegram.org/bot${tg_token}/sendMessage" \
                            -H "Content-Type: application/json" \
                            -d "${dm_payload}" 2>&1 || echo "")
                        if echo "$dm_res" | grep -q '"ok":true'; then
                            echo -e "   ${GREEN}● Direct test message successfully sent to Admin (@${bot_username} -> You)!${NC}"
                            echo -e "   👉 Check your Telegram private chat with @${bot_username} now."
                        else
                            local dm_err
                            dm_err=$(echo "$dm_res" | grep -o '"description":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "$dm_res")
                            echo -e "   ${YELLOW}⚠️ Could not send direct message to Admin ID ${tg_admin}: ${dm_err}${NC}"
                            echo -e "   ${YELLOW}👉 Make sure you have opened @${bot_username} in Telegram and sent /start at least once.${NC}"
                        fi
                    fi

                    # 7. Check Systemd Service Status
                    echo ""
                    echo -e "7. Checking Background Interactive Service (${SERVICE_NAME})..."
                    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
                        echo -e "   ${GREEN}● Backend Node.js Service is RUNNING! (Interactive polling active)${NC}"
                    else
                        echo -e "   ${RED}❌ Backend Service is STOPPED or NOT RUNNING!${NC}"
                        echo -e "   ${YELLOW}👉 This is why the bot does not respond to /start in real-time!${NC}"
                        echo -e "   👉 Starting service now..."
                        run_as_root systemctl daemon-reload
                        run_as_root systemctl restart "${SERVICE_NAME}" 2>/dev/null || true
                        sleep 2
                        if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
                            echo -e "   ${GREEN}● Service has been STARTED successfully!${NC}"
                        else
                            echo -e "   ${RED}❌ Please run option 19 (Rebuild & Restart) to compile and launch the service.${NC}"
                        fi
                    fi

                    # 8. Offer Live Test Message to Channel
                    echo ""
                    prompt_user "Would you like to send a LIVE TEST POST to ${probe_ch} right now? [y/N]: " send_test "N"
                    if [[ "$send_test" =~ ^[Yy]$ ]]; then
                        log_info "Sending formatted test post to ${probe_ch}..."
                        local test_text="🎉 <b>تست موفقیت‌آمیز ارتباط ربات با کانال حسابداری ایران</b>%0A%0A✅ سیستم ارسال خودکار محتوای آموزشی با موفقیت به این کانال متصل گردید.%0A⏰ زمان تست: $(date +"%Y-%m-%d %H:%M:%S")%0A%0A📢 <i>پست‌های دوره طبق برنامه زمان‌بندی روزانه منتشر خواهند شد.</i>"
                        local send_res
                        send_res=$(curl -s -m 15 "https://api.telegram.org/bot${tg_token}/sendMessage?chat_id=${probe_ch}&text=${test_text}&parse_mode=HTML" 2>&1 || echo "")
                        if echo "$send_res" | grep -q '"ok":true'; then
                            log_success "LIVE TEST POST PUBLISHED SUCCESSFULLY to ${probe_ch}!"
                            echo -e "   👉 Check your channel now to see the post!"
                        else
                            local err_desc
                            err_desc=$(echo "$send_res" | grep -o '"description":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "$send_res")
                            log_error "Failed to publish test post: ${err_desc}"
                        fi
                    fi
                else
                    local chat_err
                    chat_err=$(echo "$chat_json" | grep -o '"description":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "$chat_json")
                    echo -e "   ${RED}❌ Telegram could not find channel '${probe_ch}'!${NC}"
                    echo -e "   Telegram API Error: ${YELLOW}${chat_err}${NC}"
                    echo -e "   ${YELLOW}👉 If channel is PUBLIC: make sure you set a public link in Telegram and use @YourChannelName.${NC}"
                    echo -e "   ${YELLOW}👉 If channel is PRIVATE: add @${bot_username} as Administrator first, then use its numeric ID (-100...).${NC}"
                fi
            fi
        else
            local err_desc
            err_desc=$(echo "$me_json" | grep -o '"description":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "$me_json")
            echo -e "   ${RED}❌ Telegram API rejected bot token! Error: ${err_desc}${NC}"
            echo -e "   ${YELLOW}👉 Check your bot token from @BotFather.${NC}"
        fi
    fi

    # 7. Check Bale Bot (optional)
    if [ -n "$bale_token" ]; then
        echo ""
        echo -e "6. Testing Bale Bot Token..."
        local bale_me
        bale_me=$(curl -s -m 10 "https://tapi.bale.ai/bot${bale_token}/getMe" 2>&1 || echo "")
        if echo "$bale_me" | grep -q '"ok":true'; then
            local bale_name
            bale_name=$(echo "$bale_me" | grep -o '"first_name":"[^"]*' | head -n1 | cut -d'"' -f4 || echo "Bale Bot")
            echo -e "   ${GREEN}● Bale Bot is ONLINE: ${bale_name}${NC}"
        else
            echo -e "   ${YELLOW}⚠️ Bale API returned: ${bale_me}${NC}"
        fi
    fi

    echo ""
    echo "=================================================================="
    read -p "Press Enter to return to menu..." -r
}

rebuild_and_restart() {
    print_banner
    check_root
    log_info "Rebuilding and restarting ${SERVICE_NAME} to apply all new features..."
    cd "${APP_DIR}"

    log_info "Compiling web panel and backend server with esbuild..."
    npm run build

    log_info "Reloading systemd daemon..."
    run_as_root systemctl daemon-reload

    log_info "Restarting ${SERVICE_NAME} service..."
    run_as_root systemctl restart "${SERVICE_NAME}"
    sleep 2

    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        log_success "${SERVICE_NAME} is running the latest build successfully!"
    else
        log_error "${SERVICE_NAME} failed to start. Recent error logs:"
        run_as_root journalctl -u "${SERVICE_NAME}" -n 25 --no-pager
    fi
    read -p "Press Enter to return to menu..." -r
}

view_logs() {
    log_info "Displaying live logs (Press Ctrl+C to exit)..."
    run_as_root journalctl -u "${SERVICE_NAME}" -f -n 50
}

change_port() {
    print_banner
    check_root
    log_info "Configuring custom port for Accounting Bot Platform..."

    local current_port="3000"
    if [ -f "${SERVICE_FILE}" ]; then
        current_port=$(grep "\-\-port" "${SERVICE_FILE}" | awk -F'--port ' '{print $2}' | tr -d ' ' || echo "3000")
        if [ -z "$current_port" ]; then
            current_port=$(grep "CUSTOM_PORT=" "${SERVICE_FILE}" | cut -d'=' -f2 || echo "3000")
        fi
    fi
    current_port="${current_port:-3000}"

    local new_port="${1:-${CLI_PORT}}"
    if [ -z "${new_port}" ]; then
        echo -e " Current Port: ${CYAN}${current_port}${NC}"
        prompt_user "Enter new port number (e.g. 80, 8080, 5000, 8585, 3000) [Default: ${current_port}]: " new_port "${current_port}"
    fi
    new_port="${new_port:-$current_port}"

    if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
        log_error "Invalid port number. Port must be between 1 and 65535."
        sleep 2
        return 1
    fi

    log_info "Updating systemd service and .env with Port ${new_port}..."
    local run_user
    run_user=$(whoami)
    local node_path
    node_path=$(command -v node)

    # Update .env
    if [ -f "${APP_DIR}/.env" ]; then
        if grep -q "^PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^PORT=.*/PORT=${new_port}/" "${APP_DIR}/.env"
        else
            echo "PORT=${new_port}" >> "${APP_DIR}/.env"
        fi
        if grep -q "^APP_PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^APP_PORT=.*/APP_PORT=${new_port}/" "${APP_DIR}/.env"
        else
            echo "APP_PORT=${new_port}" >> "${APP_DIR}/.env"
        fi
        if grep -q "^CUSTOM_PORT=" "${APP_DIR}/.env"; then
            sed -i "s/^CUSTOM_PORT=.*/CUSTOM_PORT=${new_port}/" "${APP_DIR}/.env"
        else
            echo "CUSTOM_PORT=${new_port}" >> "${APP_DIR}/.env"
        fi
    fi

    local service_content="[Unit]
Description=Accounting Bot Platform for Telegram and Bale (Iran)
After=network.target

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs --port ${new_port}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${new_port}
Environment=APP_PORT=${new_port}
Environment=CUSTOM_PORT=${new_port}

[Install]
WantedBy=multi-user.target
"
    echo "${service_content}" | run_as_root tee "${SERVICE_FILE}" >/dev/null
    run_as_root systemctl daemon-reload
    run_as_root systemctl restart "${SERVICE_NAME}"

    # Automatically open the new port in firewall
    configure_firewall "${new_port}"

    local server_ip
    server_ip=$(curl -s -4 icanhazip.com || curl -s -4 ifconfig.me || echo "SERVER_IP")

    log_success "Port successfully updated to ${new_port}!"
    echo -e " Web Panel URL: ${CYAN}http://${server_ip}:${new_port}${NC}"
    echo -e " Local URL:     ${CYAN}http://localhost:${new_port}${NC}"
    echo ""
    read -p "Press Enter to return to menu..." -r
}

# ==============================================================================
# Troubleshooting & Diagnostic Auto-Fixer
# ==============================================================================
diagnose_and_fix() {
    print_banner
    check_root
    echo -e "${CYAN}${BOLD}=== 🔍 Diagnostic & Connection Auto-Fix Tool ===${NC}"
    echo ""

    local current_port="3000"
    if [ -f "${SERVICE_FILE}" ]; then
        current_port=$(grep "\-\-port" "${SERVICE_FILE}" | awk -F'--port ' '{print $2}' | tr -d ' ' || echo "3000")
        if [ -z "$current_port" ]; then
            current_port=$(grep "CUSTOM_PORT=" "${SERVICE_FILE}" | cut -d'=' -f2 || echo "3000")
        fi
    fi
    current_port="${current_port:-3000}"

    echo -e "1. Checking Systemd Service (${SERVICE_NAME})..."
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo -e "   Status: ${GREEN}● RUNNING${NC}"
    else
        echo -e "   Status: ${RED}○ STOPPED or FAILED${NC}"
        echo -e "   Attempting to start service..."
        run_as_root systemctl restart "${SERVICE_NAME}"
        sleep 2
        if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
            echo -e "   ${GREEN}Service restarted successfully.${NC}"
        else
            echo -e "   ${RED}Service failed to start. Recent error logs:${NC}"
            run_as_root journalctl -u "${SERVICE_NAME}" -n 20 --no-pager
        fi
    fi
    echo ""

    echo -e "2. Checking Listening Ports on Server (Target: ${current_port})..."
    local port_active="0"
    if command -v ss >/dev/null 2>&1; then
        if ss -tulpn | grep -q ":${current_port} "; then
            port_active="1"
            echo -e "   ${GREEN}Port ${current_port} is actively listening on TCP.${NC}"
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tlpn | grep -q ":${current_port} "; then
            port_active="1"
            echo -e "   ${GREEN}Port ${current_port} is actively listening on TCP.${NC}"
        fi
    fi

    if [ "${port_active}" = "0" ]; then
        echo -e "   ${YELLOW}No process detected on Port ${current_port}.${NC}"
        echo -e "   Re-compiling and restarting..."
        cd "${APP_DIR}" && npm run build && run_as_root systemctl restart "${SERVICE_NAME}"
    fi
    echo ""

    echo -e "3. Unblocking Firewalls on OS (UFW, Firewalld, iptables)..."
    configure_firewall "${current_port}"
    echo ""

    echo -e "4. Testing Local HTTP Request to http://127.0.0.1:${current_port}/api/health..."
    local local_http_code
    local_http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${current_port}/api/health" || echo "000")
    if [ "${local_http_code}" = "200" ]; then
        echo -e "   ${GREEN}Local connection test SUCCESS (HTTP 200 OK)!${NC}"
    else
        echo -e "   ${YELLOW}Local connection returned code: ${local_http_code}${NC}"
    fi
    echo ""

    local server_ip
    server_ip=$(curl -s -4 icanhazip.com || curl -s -4 ifconfig.me || echo "45.144.48.211")

    echo "=================================================================="
    echo -e "  🌐 Web Panel Address: ${CYAN}http://${server_ip}:${current_port}${NC}"
    echo "=================================================================="
    echo -e "${YELLOW}🚨 IMPORTANT NOTE IF BROWSER SAYS 'ERR_CONNECTION_REFUSED':${NC}"
    echo -e "If the local test succeeded but you cannot open http://${server_ip}:${current_port}"
    echo -e "from your browser, your VPS Cloud Provider (e.g. Hetzner, Arvan, AWS,"
    echo -e "DigitalOcean) is blocking Port ${current_port} in their Cloud Firewall panel."
    echo -e "👉 Fix: Go to your VPS control panel -> Firewall / Security Groups,"
    echo -e "   and add an INBOUND rule allowing TCP traffic on Port ${current_port}."
    echo "=================================================================="
    echo ""
    read -p "Press Enter to return to menu..." -r
}

# ==============================================================================
# Domain & SSL (Let's Encrypt / Certbot) Configuration
# ==============================================================================
setup_domain_and_ssl() {
    local target_port="${1:-3000}"
    local target_domain="$2"
    local enable_ssl="$3"
    local ssl_email="$4"

    echo ""
    echo -e "${CYAN}${BOLD}=== 🌐 Domain & Let's Encrypt SSL Configuration ===${NC}"

    if [ -z "${target_domain}" ]; then
        read -p "Enter your domain name (e.g. panel.example.com or acc.myweb.ir): " target_domain
    fi

    if [ -z "${target_domain}" ]; then
        log_warning "No domain entered. Skipping domain configuration."
        return 0
    fi

    target_domain=$(echo "${target_domain}" | tr -d ' ' | tr '[:upper:]' '[:lower:]')

    if [ -z "${enable_ssl}" ]; then
        read -p "Acquire free Let's Encrypt SSL certificate for ${target_domain}? [y/N]: " ssl_choice
        if [[ "$ssl_choice" =~ ^[Yy]$ ]]; then
            enable_ssl="1"
        else
            enable_ssl="0"
        fi
    fi

    if [ "${enable_ssl}" = "1" ] && [ -z "${ssl_email}" ]; then
        read -p "Enter email for SSL expiration notices (optional, press Enter to skip): " ssl_email
    fi

    log_info "Installing Nginx web server..."
    if command -v apt-get >/dev/null 2>&1; then
        run_as_root apt-get update -y
        run_as_root apt-get install -y nginx
    elif command -v yum >/dev/null 2>&1; then
        run_as_root yum install -y nginx
    elif command -v dnf >/dev/null 2>&1; then
        run_as_root dnf install -y nginx
    fi

    local nginx_conf="/etc/nginx/sites-available/${SERVICE_NAME}"
    local nginx_link="/etc/nginx/sites-enabled/${SERVICE_NAME}"
    [ -d "/etc/nginx/sites-available" ] || run_as_root mkdir -p /etc/nginx/sites-available
    [ -d "/etc/nginx/sites-enabled" ] || run_as_root mkdir -p /etc/nginx/sites-enabled

    log_info "Creating Nginx reverse proxy configuration for ${target_domain} -> Port ${target_port}..."
    local nginx_content="server {
    listen 80;
    listen [::]:80;
    server_name ${target_domain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${target_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }
}
"
    echo "${nginx_content}" | run_as_root tee "${nginx_conf}" >/dev/null
    run_as_root ln -sf "${nginx_conf}" "${nginx_link}"

    # Remove default nginx site if conflicts
    run_as_root rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    log_info "Testing Nginx syntax..."
    if run_as_root nginx -t; then
        run_as_root systemctl enable nginx 2>/dev/null || true
        run_as_root systemctl restart nginx
        log_success "Nginx reverse proxy configured and running!"
    else
        log_error "Nginx configuration test failed. Please check /etc/nginx configuration."
        return 1
    fi

    # Issue Let's Encrypt SSL
    if [ "${enable_ssl}" = "1" ]; then
        log_info "Installing Certbot for Let's Encrypt SSL..."
        if command -v apt-get >/dev/null 2>&1; then
            run_as_root apt-get install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            run_as_root yum install -y certbot python3-certbot-nginx
        fi

        log_info "Requesting SSL certificate from Let's Encrypt for ${target_domain}..."
        local certbot_cmd="certbot --nginx -d ${target_domain} --non-interactive --agree-tos --redirect"
        if [ -n "${ssl_email}" ]; then
            certbot_cmd="${certbot_cmd} -m ${ssl_email}"
        else
            certbot_cmd="${certbot_cmd} --register-unsafely-without-email"
        fi

        if run_as_root ${certbot_cmd}; then
            log_success "SSL certificate successfully acquired and applied to Nginx!"
            echo -e " ${GREEN}${BOLD}Secure URL: https://${target_domain}${NC}"
        else
            log_warning "Certbot was unable to verify domain ownership automatically."
            log_warning "Ensure your domain's DNS A-Record points to this server's IP address, then try again."
        fi
    else
        echo -e " ${GREEN}${BOLD}HTTP URL: http://${target_domain}${NC}"
    fi

    # Firewall
    if command -v ufw >/dev/null 2>&1; then
        run_as_root ufw allow 80/tcp >/dev/null 2>&1 || true
        run_as_root ufw allow 443/tcp >/dev/null 2>&1 || true
    fi

    echo ""
    read -p "Press Enter to continue..." -r
}

renew_ssl() {
    log_info "Testing and renewing Let's Encrypt SSL certificates..."
    if command -v certbot >/dev/null 2>&1; then
        run_as_root certbot renew
        run_as_root systemctl reload nginx 2>/dev/null || true
        log_success "SSL renewal process completed."
    else
        log_error "Certbot is not installed. Please configure Domain & SSL first."
    fi
    read -p "Press Enter to return to menu..." -r
}

# ==============================================================================
# Interactive Menu (Sanaei Style)
# ==============================================================================
show_menu() {
    print_banner
    local status_line
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        status_line="${GREEN}● Running${NC}"
    else
        status_line="${RED}○ Stopped${NC}"
    fi

    local current_port="3000"
    if [ -f "${SERVICE_FILE}" ]; then
        current_port=$(grep "\-\-port" "${SERVICE_FILE}" | awk -F'--port ' '{print $2}' | tr -d ' ' || echo "3000")
        if [ -z "$current_port" ]; then
            current_port=$(grep "CUSTOM_PORT=" "${SERVICE_FILE}" | cut -d'=' -f2 || echo "3000")
        fi
    fi
    current_port="${current_port:-3000}"

    local current_tg_admin
    current_tg_admin=$(get_env_val "TELEGRAM_ADMIN_CHAT_ID")
    local admin_line
    if [ -n "${current_tg_admin}" ]; then
        admin_line="${GREEN}${current_tg_admin}${NC}"
    else
        admin_line="${YELLOW}Not configured (Choose 8 to set)${NC}"
    fi

    echo -e " Service Status:         ${status_line}"
    echo -e " Web Panel Port:         ${CYAN}${current_port}${NC}"
    echo -e " Main Telegram Admin ID: ${admin_line}"
    echo -e " Application Directory:  ${CYAN}${APP_DIR}${NC}"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}1)${NC} Install Platform & Systemd Service"
    echo -e " ${GREEN}2)${NC} Update Platform (${YELLOW}Auto-Backup to Telegram/Bale Bots${NC})"
    echo -e " ${GREEN}3)${NC} Uninstall Platform (${YELLOW}Auto-Backup to Telegram/Bale Bots${NC})"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}4)${NC} Start Service"
    echo -e " ${GREEN}5)${NC} Stop Service"
    echo -e " ${GREEN}6)${NC} Restart Service"
    echo -e " ${GREEN}7)${NC} Change Web Panel Port"
    echo -e " ${GREEN}8)${NC} Configure Main Admin ID & Bot Tokens (Telegram & Bale)"
    echo -e " ${GREEN}9)${NC} Configure Domain & Optional SSL (Let's Encrypt)"
    echo -e " ${GREEN}10)${NC} Renew / Test SSL Certificate"
    echo -e " ${GREEN}11)${NC} Diagnose & Auto-Fix Connection / Firewall"
    echo -e " ${GREEN}12)${NC} Check Status & Admin Info"
    echo -e " ${GREEN}13)${NC} View Realtime Service Logs"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}14)${NC} Create Instant Backup & Send to Main Admin Now"
    echo -e " ${GREEN}15)${NC} Enable Auto-Start on Boot"
    echo -e " ${GREEN}16)${NC} Disable Auto-Start on Boot"
    echo -e " ${GREEN}17)${NC} ${CYAN}⚡ 24/7 Auto-Pilot Daily Scheduler & Test Triggers${NC}"
    echo -e " ${GREEN}18)${NC} ${CYAN}🔍 Comprehensive Telegram & Bale Diagnostics (Tokens, Channels, Rights & Menu)${NC}"
    echo -e " ${GREEN}19)${NC} ${YELLOW}🔄 Rebuild & Restart Backend Service (npm run build && restart)${NC}"
    echo -e " ${GREEN}20)${NC} ${PURPLE}📥 Restore System from Backup (data_persistence / archive / file)${NC}"
    echo "----------------------------------------------------------------"
    echo -e " ${RED}0)${NC} Exit"
    echo ""
    prompt_user "Please select an option [0-20]: " choice ""
    case "$choice" in
        1) do_install ;;
        2) do_update ;;
        3) do_uninstall ;;
        4) start_service ;;
        5) stop_service ;;
        6) restart_service ;;
        7) change_port ;;
        8) configure_bot_and_admin; read -p "Press Enter to return to menu..." -r; show_menu ;;
        9) setup_domain_and_ssl ;;
        10) renew_ssl ;;
        11) diagnose_and_fix ;;
        12) do_status; show_menu ;;
        13) view_logs ;;
        14) create_and_send_backup "Manual Menu Trigger"; read -p "Press Enter to return to menu..." -r; show_menu ;;
        15) enable_service ;;
        16) disable_service ;;
        17) manage_scheduler_cli; show_menu ;;
        18) diagnose_telegram_and_channel; show_menu ;;
        19) rebuild_and_restart; show_menu ;;
        20) restore_system_backup; show_menu ;;
        0) exit 0 ;;
        *) log_error "Invalid selection"; sleep 1; show_menu ;;
    esac
}

# ==============================================================================
# Entry Point & Advanced Argument Parsing
# ==============================================================================
CLI_ACTION=""
CLI_PORT=""
CLI_DOMAIN=""
CLI_SSL="0"
CLI_EMAIL=""
CLI_ADMIN_ID=""
CLI_BOT_TOKEN=""
CLI_CHANNEL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --install|-i)
            CLI_ACTION="install"
            shift
            ;;
        --update|-u)
            CLI_ACTION="update"
            shift
            ;;
        --uninstall)
            CLI_ACTION="uninstall"
            shift
            ;;
        --rebuild)
            CLI_ACTION="rebuild"
            shift
            ;;
        --test-bot|--bot-diag)
            CLI_ACTION="bot_diag"
            shift
            ;;
        --backup|-b)
            CLI_ACTION="backup"
            shift
            ;;
        --restore)
            CLI_ACTION="restore"
            shift
            ;;
        --status|-s)
            CLI_ACTION="status"
            shift
            ;;
        --diagnose|--fix|-t)
            CLI_ACTION="diagnose"
            shift
            ;;
        --restart|-r)
            CLI_ACTION="restart"
            shift
            ;;
        --admin|--bot|admin|bot)
            CLI_ACTION="admin"
            shift
            ;;
        --admin-id|-a)
            CLI_ADMIN_ID="$2"
            shift 2
            ;;
        --token|--bot-token)
            CLI_BOT_TOKEN="$2"
            shift 2
            ;;
        --channel)
            CLI_CHANNEL="$2"
            shift 2
            ;;
        --port|-p|port)
            if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
                CLI_PORT="$2"
                shift 2
            else
                CLI_ACTION="port"
                shift
            fi
            ;;
        --domain|-d)
            CLI_DOMAIN="$2"
            shift 2
            ;;
        --ssl)
            CLI_SSL="1"
            shift
            ;;
        --email|-m)
            CLI_EMAIL="$2"
            shift 2
            ;;
        --logs|-l)
            CLI_ACTION="logs"
            shift
            ;;
        --scheduler|-sc|scheduler)
            CLI_ACTION="scheduler"
            shift
            ;;
        *)
            if [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; then
                CLI_PORT="$1"
            fi
            shift
            ;;
    esac
done

# Check if PORT or APP_PORT environment variable was pre-set in the shell
if [ -z "${CLI_PORT}" ]; then
    if [ -n "${PORT}" ] && [[ "${PORT}" =~ ^[0-9]+$ ]]; then
        CLI_PORT="${PORT}"
    elif [ -n "${APP_PORT}" ] && [[ "${APP_PORT}" =~ ^[0-9]+$ ]]; then
        CLI_PORT="${APP_PORT}"
    elif [ -n "${CUSTOM_PORT}" ] && [[ "${CUSTOM_PORT}" =~ ^[0-9]+$ ]]; then
        CLI_PORT="${CUSTOM_PORT}"
    fi
fi

case "${CLI_ACTION}" in
    install)
        do_install
        ;;
    update)
        do_update
        ;;
    uninstall)
        do_uninstall
        ;;
    backup)
        create_and_send_backup "CLI Flag"
        ;;
    restore)
        restore_system_backup
        ;;
    status)
        do_status
        ;;
    diagnose)
        diagnose_and_fix
        ;;
    bot_diag)
        diagnose_telegram_and_channel
        ;;
    rebuild)
        rebuild_and_restart
        ;;
    restart)
        restart_service
        ;;
    admin)
        configure_bot_and_admin
        ;;
    port)
        if [ -n "${CLI_PORT}" ]; then
            new_port="${CLI_PORT}"
            change_port
        else
            change_port
        fi
        ;;
    logs)
        view_logs
        ;;
    scheduler)
        manage_scheduler_cli
        ;;
    *)
        show_menu
        ;;
esac
