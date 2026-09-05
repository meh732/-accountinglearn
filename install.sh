#!/usr/bin/env bash
# ==============================================================================
# Accounting Bot Platform for Telegram & Bale (Iran)
# Linux Installation, Update, and Management Script
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SERVICE_NAME="accounting-bot"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="accounting_bot_backup_${TIMESTAMP}.tar.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "=================================================================="
    echo "   ACCOUNTING BOT PLATFORM FOR TELEGRAM & BALE (IRAN)            "
    echo "   Automated Installer, Updater & Backup Management Script       "
    echo "=================================================================="
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
        log_warning "Root privileges may be needed for systemd operations."
        log_info "If prompted, please enter your sudo password."
    fi
}

check_dependencies() {
    log_info "Verifying required system packages..."
    local missing_pkgs=()

    command -v curl >/dev/null 2>&1 || missing_pkgs+=("curl")
    command -v tar >/dev/null 2>&1 || missing_pkgs+=("tar")
    command -v node >/dev/null 2>&1 || missing_pkgs+=("nodejs")
    command -v npm >/dev/null 2>&1 || missing_pkgs+=("npm")

    if [ ${#missing_pkgs[@]} -gt 0 ]; then
        log_warning "Missing packages: ${missing_pkgs[*]}"
        if [ "$EUID" -eq 0 ]; then
            apt-get update -y && apt-get install -y "${missing_pkgs[@]}" || true
        else
            sudo apt-get update -y && sudo apt-get install -y "${missing_pkgs[@]}" || true
        fi
    fi

    local node_version
    node_version=$(node -v 2>/dev/null || echo "v0")
    log_success "Node.js detected: ${node_version}"
    log_success "npm detected: $(npm -v 2>/dev/null || echo "v0")"
}

# ==============================================================================
# Backup Generation & Bot Dispatch
# ==============================================================================
create_and_send_backup() {
    local reason="$1" # e.g. "Pre-Update" or "Pre-Uninstall" or "Manual"
    log_info "Creating project backup (${reason})..."

    mkdir -p "${BACKUP_DIR}"

    # Create archive with source, configs, env, and data
    tar --exclude="node_modules" \
        --exclude=".git" \
        --exclude="backups" \
        -czf "${BACKUP_FILEPATH}" -C "${APP_DIR}" .

    local file_size
    file_size=$(du -h "${BACKUP_FILEPATH}" | cut -f1)
    log_success "Backup archive created: ${BACKUP_FILENAME} (${file_size})"

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
            log_success "Backup file successfully delivered to Telegram Admin!"
        else
            log_warning "Telegram upload notice: $(echo "${tg_response}" | grep -o '"description":"[^"]*' || echo "Check network/token")"
        fi
    else
        log_info "Telegram backup skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set in .env)."
    fi

    # Dispatch to Bale Bot
    if [ -n "${bale_token}" ] && [ -n "${bale_admin_id}" ]; then
        log_info "Dispatching backup notice to Bale Admin (${bale_admin_id})..."
        local bale_text="📦 Backup Notification (${reason}) - Date: $(date +"%Y-%m-%d %H:%M:%S") - File: ${BACKUP_FILENAME} (${file_size})"
        
        # Send text notice to Bale (and file if endpoint reachable)
        curl -s -X POST "https://tapi.bale.ai/bot${bale_token}/sendMessage" \
            -H "Content-Type: application/json" \
            -d "{\"chat_id\":\"${bale_admin_id}\",\"text\":\"${bale_text}\"}" >/dev/null 2>&1 || true

        log_success "Backup notice dispatched to Bale Bot!"
    else
        log_info "Bale backup skipped (BALE_BOT_TOKEN or BALE_ADMIN_CHAT_ID not set in .env)."
    fi

    log_success "Backup stored locally at: ${BACKUP_FILEPATH}"
}

# ==============================================================================
# Installation
# ==============================================================================
do_install() {
    print_banner
    log_info "Starting installation of Accounting Bot Platform..."
    check_dependencies

    cd "${APP_DIR}"

    # Setup environment file if missing
    if [ ! -f "${APP_DIR}/.env" ]; then
        if [ -f "${APP_DIR}/.env.example" ]; then
            log_info "Creating .env configuration file from template..."
            cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
        else
            touch "${APP_DIR}/.env"
        fi
    fi

    log_info "Installing Node.js dependencies..."
    npm install

    log_info "Building frontend & backend bundle..."
    npm run build

    # Create systemd service
    log_info "Configuring systemd service (${SERVICE_NAME})..."
    local current_user
    current_user=$(whoami)
    local node_path
    node_path=$(command -v node)

    local service_content="[Unit]
Description=Accounting Bot Platform for Telegram and Bale (Iran)
After=network.target

[Service]
Type=simple
User=${current_user}
WorkingDirectory=${APP_DIR}
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
"

    if [ "$EUID" -eq 0 ]; then
        echo "${service_content}" > "${SERVICE_FILE}"
        systemctl daemon-reload
        systemctl enable "${SERVICE_NAME}"
        systemctl restart "${SERVICE_NAME}"
    else
        echo "${service_content}" | sudo tee "${SERVICE_FILE}" >/dev/null
        sudo systemctl daemon-reload
        sudo systemctl enable "${SERVICE_NAME}"
        sudo systemctl restart "${SERVICE_NAME}"
    fi

    log_success "Service ${SERVICE_NAME} installed and started successfully!"
    echo -e "${GREEN}${BOLD}"
    echo "=================================================================="
    echo "  INSTALLATION COMPLETE!                                          "
    echo "  Dashboard URL: http://localhost:3000                            "
    echo "  Check Status : systemctl status ${SERVICE_NAME}                 "
    echo "  View Logs    : journalctl -u ${SERVICE_NAME} -f                 "
    echo "=================================================================="
    echo -e "${NC}"
}

# ==============================================================================
# Update
# ==============================================================================
do_update() {
    print_banner
    log_info "Starting Update process..."
    check_dependencies

    cd "${APP_DIR}"

    # 1. Automatic Backup before update and send to bots
    create_and_send_backup "Pre-Update"

    # 2. Pull Git updates if in a git repository
    if [ -d "${APP_DIR}/.git" ]; then
        log_info "Pulling latest changes from repository..."
        git pull || log_warning "Git pull encountered warnings, continuing..."
    else
        log_info "Not a git repository, applying local updates."
    fi

    # 3. Reinstall dependencies and rebuild
    log_info "Updating dependencies..."
    npm install

    log_info "Rebuilding application..."
    npm run build

    # 4. Restart service
    log_info "Restarting ${SERVICE_NAME} service..."
    if [ "$EUID" -eq 0 ]; then
        systemctl daemon-reload
        systemctl restart "${SERVICE_NAME}"
    else
        sudo systemctl daemon-reload
        sudo systemctl restart "${SERVICE_NAME}"
    fi

    log_success "Update completed successfully! Backup was archived & sent to admin bots."
}

# ==============================================================================
# Uninstall
# ==============================================================================
do_uninstall() {
    print_banner
    log_warning "You have initiated the UNINSTALL process."
    read -p "Are you sure you want to proceed with uninstallation? (y/N): " -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Uninstallation canceled."
        exit 0
    fi

    # 1. Automatic Final Backup before uninstall and send to bots
    create_and_send_backup "Pre-Uninstall"

    # 2. Stop and disable systemd service
    log_info "Stopping and disabling ${SERVICE_NAME} service..."
    if [ "$EUID" -eq 0 ]; then
        systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
        systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
        rm -f "${SERVICE_FILE}"
        systemctl daemon-reload
    else
        sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
        sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
        sudo rm -f "${SERVICE_FILE}"
        sudo systemctl daemon-reload
    fi

    log_success "Service ${SERVICE_NAME} has been removed."

    read -p "Do you also want to remove project files (backups will be preserved)? (y/N): " -r rm_files
    if [[ "$rm_files" =~ ^[Yy]$ ]]; then
        log_info "Cleaning project build artifacts..."
        rm -rf "${APP_DIR}/dist" "${APP_DIR}/node_modules"
        log_success "Artifacts removed. Backups remain safely in: ${BACKUP_DIR}"
    fi

    echo -e "${GREEN}${BOLD}"
    echo "=================================================================="
    echo "  UNINSTALLATION COMPLETE!                                        "
    echo "  Final backup was dispatched to your Telegram/Bale bots and      "
    echo "  is archived in: ${BACKUP_DIR}                                   "
    echo "=================================================================="
    echo -e "${NC}"
}

# ==============================================================================
# Status
# ==============================================================================
do_status() {
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo -e "${GREEN}${BOLD}Service ${SERVICE_NAME} is RUNNING${NC}"
        systemctl status "${SERVICE_NAME}" --no-pager
    else
        echo -e "${RED}${BOLD}Service ${SERVICE_NAME} is NOT RUNNING${NC}"
        systemctl status "${SERVICE_NAME}" --no-pager 2>/dev/null || true
    fi
}

# ==============================================================================
# Interactive Menu
# ==============================================================================
show_menu() {
    print_banner
    echo "Please choose an action:"
    echo "  1) Install Application & Systemd Service"
    echo "  2) Update Application (Auto-Backups & Sends to Admin Bots)"
    echo "  3) Uninstall Application (Auto-Backups & Sends to Admin Bots)"
    echo "  4) Create Manual Backup & Send to Bots Now"
    echo "  5) Check Service Status"
    echo "  6) Exit"
    echo ""
    read -p "Enter choice [1-6]: " choice
    case "$choice" in
        1) do_install ;;
        2) do_update ;;
        3) do_uninstall ;;
        4) create_and_send_backup "Manual" ;;
        5) do_status ;;
        6) exit 0 ;;
        *) log_error "Invalid selection"; exit 1 ;;
    esac
}

# CLI Argument parsing
case "$1" in
    --install)
        do_install
        ;;
    --update)
        do_update
        ;;
    --uninstall)
        do_uninstall
        ;;
    --backup)
        create_and_send_backup "Manual"
        ;;
    --status)
        do_status
        ;;
    *)
        show_menu
        ;;
esac
