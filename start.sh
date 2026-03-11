#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Vérifier si on est root ou utiliser sudo
if [[ $EUID -eq 0 ]]; then
   log_warning "Ce script est exécuté en tant que root"
fi

# Configuration des variables
ANDROID_SDK_DIR="$HOME/Android/Sdk"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"

log_info "Début de l'installation du SDK Android..."

# Vérifier et créer le lien symbolique pour adb si nécessaire
if [ -f "/home/coder/platform-tools/adb" ]; then
    if [ ! -L "/usr/local/bin/adb" ]; then
        sudo ln -s /home/coder/platform-tools/adb /usr/local/bin/adb
        log_info "Lien symbolique adb créé"
    else
        log_info "Lien symbolique adb existe déjà"
    fi
else
    log_warning "adb non trouvé dans /home/coder/platform-tools/"
fi

# Mise à jour des paquets
log_info "Mise à jour des paquets..."
sudo apt update -qq

# Installation de Java si nécessaire
if ! command -v java &> /dev/null; then
    log_info "Installation de Java 17..."
    sudo apt install -y openjdk-17-jdk
else
    log_info "Java est déjà installé"
    java -version
fi

# Créer les répertoires nécessaires
log_info "Création des répertoires SDK..."
mkdir -p "$ANDROID_SDK_DIR/cmdline-tools"

# Télécharger les command line tools si nécessaire
if [ ! -d "$ANDROID_SDK_DIR/cmdline-tools/latest" ]; then
    log_info "Téléchargement des Android Command Line Tools..."
    cd "$ANDROID_SDK_DIR/cmdline-tools" || log_error "Impossible d'accéder au répertoire"

    wget -q --show-progress "$CMDLINE_TOOLS_URL" -O cmdline-tools.zip || log_error "Échec du téléchargement"

    log_info "Extraction des outils..."
    unzip -q cmdline-tools.zip || log_error "Échec de l'extraction"
    rm cmdline-tools.zip

    # Renommer le dossier
    mv cmdline-tools latest || log_error "Impossible de renommer le dossier"
else
    log_info "Command Line Tools déjà installés"
fi

# Vérifier si les variables sont déjà dans .bashrc
if ! grep -q "ANDROID_HOME" ~/.bashrc; then
    log_info "Ajout des variables d'environnement à .bashrc..."

    cat >> ~/.bashrc << 'EOL'

# Android SDK
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$JAVA_HOME/bin
EOL
else
    log_info "Variables d'environnement déjà configurées dans .bashrc"
fi

# Exporter les variables pour la session courante
export ANDROID_HOME="$ANDROID_SDK_DIR"
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$JAVA_HOME/bin

# Accepter les licences
log_info "Acceptation des licences Android SDK..."
yes | sdkmanager --licenses &> /dev/null

# Installer les composants nécessaires
log_info "Installation des composants SDK..."
sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34" || log_warning "Certains composants n'ont pas pu être installés"

# Vérification finale
log_info "Vérification de l'installation..."
if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓${NC} adb: $(adb --version | head -n1)"
fi

if [ -d "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓${NC} ANDROID_HOME: $ANDROID_HOME"
fi

if command -v sdkmanager &> /dev/null; then
    echo -e "${GREEN}✓${NC} sdkmanager: installé"
fi

if command -v java &> /dev/null; then
    echo -e "${GREEN}✓${NC} Java: $(java -version 2>&1 | head -n1)"
fi

# Message final
echo ""
log_info "Installation terminée avec succès!"
log_info "Pour appliquer les changements dans votre session actuelle:"
echo -e "   ${YELLOW}source ~/.bashrc${NC}"
echo ""
log_info "Pour vérifier: echo \$ANDROID_HOME"

# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# install cloudflared
sudo apt-get update && sudo apt-get install cloudflared

npm install --global eas-cli

curl -fsSL https://claude.ai/install.sh | bash

echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
