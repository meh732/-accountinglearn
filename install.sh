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
if [ -f "$(pwd)/package.json" ] && grep -q "accounting" "$(pwd)/package.json" 2>/dev/null; then
    APP_DIR="$(pwd)"
elif [ -d "${INSTALL_DIR}" ]; then
    APP_DIR="${INSTALL_DIR}"
else
    APP_DIR="${INSTALL_DIR}"
fi

BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="accounting_bot_backup_${TIMESTAMP}.tar.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

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

    # Port Configuration
    local default_port=3000
    echo ""
    read -p "Enter web panel port [Default: ${default_port}]: " custom_port
    PORT="${custom_port:-$default_port}"

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
    log_info "Configuring systemd service (${SERVICE_NAME}.service)..."
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
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
"

    echo "${service_content}" | run_as_root tee "${SERVICE_FILE}" >/dev/null
    run_as_root systemctl daemon-reload
    run_as_root systemctl enable "${SERVICE_NAME}"
    run_as_root systemctl restart "${SERVICE_NAME}"

    # Fetch Server IP
    local server_ip
    server_ip=$(curl -s -4 icanhazip.com || curl -s -4 ifconfig.me || echo "SERVER_IP")

    echo -e "${GREEN}${BOLD}"
    echo "=================================================================="
    echo "  🎉 INSTALLATION COMPLETED SUCCESSFULLY!                         "
    echo "=================================================================="
    echo -e "  Web Panel URL   : ${CYAN}http://${server_ip}:${PORT}${GREEN}"
    echo -e "  Local URL       : ${CYAN}http://localhost:${PORT}${GREEN}"
    echo -e "  Service Name    : ${CYAN}${SERVICE_NAME}${GREEN}"
    echo -e "  Management CLI  : ${YELLOW}accountinglearn${GREEN} or ${YELLOW}acc-bot${GREEN}"
    echo "=================================================================="
    echo -e "  Simply type ${YELLOW}accountinglearn${GREEN} anywhere in your terminal to   "
    echo -e "  open the interactive management menu!                          "
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
        git pull || log_warning "Git pull encountered minor warnings, proceeding..."
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
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo -e "${GREEN}${BOLD}● ${SERVICE_NAME} is RUNNING${NC}"
        run_as_root systemctl status "${SERVICE_NAME}" --no-pager -l
    else
        echo -e "${RED}${BOLD}○ ${SERVICE_NAME} is NOT RUNNING${NC}"
        run_as_root systemctl status "${SERVICE_NAME}" --no-pager -l 2>/dev/null || true
    fi
}

view_logs() {
    log_info "Displaying live logs (Press Ctrl+C to exit)..."
    run_as_root journalctl -u "${SERVICE_NAME}" -f -n 50
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

    echo -e " Service Status: ${status_line}"
    echo -e " Application Directory: ${CYAN}${APP_DIR}${NC}"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}1)${NC} Install Platform & Systemd Service"
    echo -e " ${GREEN}2)${NC} Update Platform (${YELLOW}Auto-Backup to Telegram/Bale Bots${NC})"
    echo -e " ${GREEN}3)${NC} Uninstall Platform (${YELLOW}Auto-Backup to Telegram/Bale Bots${NC})"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}4)${NC} Start Service"
    echo -e " ${GREEN}5)${NC} Stop Service"
    echo -e " ${GREEN}6)${NC} Restart Service"
    echo -e " ${GREEN}7)${NC} Check Status & Port"
    echo -e " ${GREEN}8)${NC} View Realtime Service Logs"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}9)${NC} Create Instant Backup & Send to Bots Now"
    echo -e " ${GREEN}10)${NC} Enable Auto-Start on Boot"
    echo -e " ${GREEN}11)${NC} Disable Auto-Start on Boot"
    echo "----------------------------------------------------------------"
    echo -e " ${RED}0)${NC} Exit"
    echo ""
    read -p "Please select an option [0-11]: " choice
    case "$choice" in
        1) do_install ;;
        2) do_update ;;
        3) do_uninstall ;;
        4) start_service ;;
        5) stop_service ;;
        6) restart_service ;;
        7) do_status ;;
        8) view_logs ;;
        9) create_and_send_backup "Manual Menu Trigger" ;;
        10) enable_service ;;
        11) disable_service ;;
        0) exit 0 ;;
        *) log_error "Invalid selection"; sleep 1; show_menu ;;
    esac
}

# ==============================================================================
# Entry Point & One-Liner Handling
# ==============================================================================
# If executed with arguments:
case "$1" in
    --install|-i)
        do_install
        ;;
    --update|-u)
        do_update
        ;;
    --uninstall)
        do_uninstall
        ;;
    --backup|-b)
        create_and_send_backup "CLI Flag"
        ;;
    --status|-s)
        do_status
        ;;
    --restart|-r)
        restart_service
        ;;
    --logs|-l)
        view_logs
        ;;
    *)
        # If piped from curl or run directly, show menu (or install if not installed)
        if ! command -v "${SERVICE_NAME}" >/dev/null 2>&1 && [ ! -f "${SERVICE_FILE}" ] && [ ! -f "$(pwd)/package.json" ]; then
            do_install
        else
            show_menu
        fi
        ;;
esac
