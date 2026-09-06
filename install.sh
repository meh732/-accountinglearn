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
    if [ -z "${CLI_PORT}" ]; then
        echo ""
        echo -e "${YELLOW}>> Port Configuration (تنظیم پورت اختصاصی پنل تحت وب):${NC}"
        read -p "Enter web panel port (e.g. 80, 443, 8080, 5000, 3000) [Default: ${default_port}]: " custom_port
        PORT="${custom_port:-$default_port}"
    else
        PORT="${CLI_PORT}"
        log_info "Using custom port specified via CLI: ${PORT}"
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
    log_info "Configuring systemd service (${SERVICE_NAME}.service) on Port ${PORT}..."
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
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs --port ${PORT}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
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
        echo -e "${YELLOW}>> Domain & SSL Configuration (تنظیم دامنه و گرفتن SSL اختیاری):${NC}"
        read -p "Do you want to configure a custom domain and optional SSL (Let's Encrypt)? [y/N]: " setup_domain_choice
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

    echo -e " Current Port: ${CYAN}${current_port}${NC}"
    read -p "Enter new port number (e.g. 80, 443, 8080, 5000, 3000) [Default: 3000]: " new_port
    new_port="${new_port:-3000}"

    if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
        log_error "Invalid port number. Port must be between 1 and 65535."
        sleep 2
        return 1
    fi

    log_info "Updating systemd service with Port ${new_port}..."
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
ExecStart=${node_path} ${APP_DIR}/dist/server.cjs --port ${new_port}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
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
    echo -e " ${GREEN}7)${NC} Change Web Panel Port (تغییر پورت پنل)"
    echo -e " ${GREEN}8)${NC} Configure Domain & Optional SSL (تنظیم دامنه و گرفتن SSL رایگان)"
    echo -e " ${GREEN}9)${NC} Renew / Test SSL Certificate (تمدید و بررسی SSL)"
    echo -e " ${GREEN}10)${NC} 🔍 Diagnose & Auto-Fix Connection / Firewall (عیب‌یابی و رفع خودکار مشکل اتصال)"
    echo -e " ${GREEN}11)${NC} Check Status & Port"
    echo -e " ${GREEN}12)${NC} View Realtime Service Logs"
    echo "----------------------------------------------------------------"
    echo -e " ${GREEN}13)${NC} Create Instant Backup & Send to Bots Now"
    echo -e " ${GREEN}14)${NC} Enable Auto-Start on Boot"
    echo -e " ${GREEN}15)${NC} Disable Auto-Start on Boot"
    echo "----------------------------------------------------------------"
    echo -e " ${RED}0)${NC} Exit"
    echo ""
    read -p "Please select an option [0-15]: " choice
    case "$choice" in
        1) do_install ;;
        2) do_update ;;
        3) do_uninstall ;;
        4) start_service ;;
        5) stop_service ;;
        6) restart_service ;;
        7) change_port ;;
        8) setup_domain_and_ssl ;;
        9) renew_ssl ;;
        10) diagnose_and_fix ;;
        11) do_status ;;
        12) view_logs ;;
        13) create_and_send_backup "Manual Menu Trigger" ;;
        14) enable_service ;;
        15) disable_service ;;
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
        --backup|-b)
            CLI_ACTION="backup"
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
        --port|-p)
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
        *)
            shift
            ;;
    esac
done

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
    status)
        do_status
        ;;
    diagnose)
        diagnose_and_fix
        ;;
    restart)
        restart_service
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
    *)
        if [ -n "${CLI_PORT}" ] || [ -n "${CLI_DOMAIN}" ] || [ "${CLI_SSL}" = "1" ]; then
            do_install
        elif ! command -v "${SERVICE_NAME}" >/dev/null 2>&1 && [ ! -f "${SERVICE_FILE}" ] && [ ! -f "$(pwd)/package.json" ]; then
            do_install
        else
            show_menu
        fi
        ;;
esac
