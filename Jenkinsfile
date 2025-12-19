pipeline {
    agent any

    parameters {
        booleanParam(name: 'TRIGGER_GITOPS_CD', defaultValue: true, description: 'Update GitOps repo after build? Set to false to skip deployment.')
        booleanParam(name: 'SKIP_IMAGE_PUSH', defaultValue: false, description: 'Skip Docker image push? Set to false to skip.')
    }

    environment {
        IMAGE_NAME = 'osmosmjerka'
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = 'frontend'

        GITOPS_REPO = "${env.OSMOSMJERKA_GITOPS_REPO}"

        ADMIN_USERNAME = credentials('osmosmjerka-admin-username')
        ADMIN_PASSWORD_HASH = credentials('osmosmjerka-admin-password-hash')
        ADMIN_SECRET_KEY = credentials('osmosmjerka-admin-secret-key')
        POSTGRES_DATABASE = "${env.OSMOSMJERKA_POSTGRES_DATABASE}"
        POSTGRES_HOST = "${env.OSMOSMJERKA_POSTGRES_HOST}"
        POSTGRES_PORT = "${env.OSMOSMJERKA_POSTGRES_PORT}"
        POSTGRES_USER = credentials('osmosmjerka-db-user')
        POSTGRES_PASSWORD = credentials('osmosmjerka-db-password')

        TRIGGER_GITOPS_CD_PARAM = "${params.TRIGGER_GITOPS_CD.toString()}"
        SKIP_IMAGE_PUSH_PARAM = "${params.SKIP_IMAGE_PUSH.toString()}"
        GH_TOKEN = credentials('github_token')
    }

    stages {
        stage('Checkout') {
            steps {
                // Checkout any branch that triggers the build, ensure it has entire history
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '**']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [
                        [$class: 'CloneOption', noTags: false, shallow: false, depth: 0],
                        [$class: 'LocalBranch', localBranch: env.BRANCH_NAME]
                    ],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: 'git@github.com:bartekmp/osmosmjerka.git', credentialsId: 'github_token']]
                ])
                sh 'git config --global --add safe.directory $PWD'
                sh 'git fetch --tags'
                sh 'git fetch --all'
                sh "git pull origin ${env.BRANCH_NAME}"
                sh 'git describe --tags || echo "No tags found"'
                sh 'echo "Current branch: ${BRANCH_NAME}"'
            }
        }
        
        stage('Detect Release from GitHub Actions') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Fetch latest tags created by GitHub Actions semantic-release
                    sh 'git fetch --tags --force'
                    
                    // Get current commit SHA
                    def currentCommit = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    
                    // Check if current commit has a tag (new release from GitHub Actions)
                    def tagsOnCommit = sh(script: "git tag --points-at ${currentCommit}", returnStdout: true).trim()
                    
                    echo "Current commit: ${currentCommit}"
                    echo "Tags on commit: ${tagsOnCommit}"
                    
                    if (tagsOnCommit) {
                        // New release detected - GitHub Actions created a tag on this commit
                        // Get the first tag (semantic-release typically creates one tag per release)
                        def releaseTag = tagsOnCommit.split('\n')[0].trim()
                        echo "New release detected: ${releaseTag}"
                        env.IS_NEW_RELEASE = 'true'
                        env.TRIGGER_GITOPS_CD = env.TRIGGER_GITOPS_CD_PARAM ?: 'true'
                        env.SKIP_IMAGE_PUSH = env.SKIP_IMAGE_PUSH_PARAM ?: 'false'
                        
                        // Extract version from pyproject.toml (semantic-release updates it)
                        // This ensures we get the exact version that was released
                        def version = sh(script: "grep '^version' pyproject.toml | head -1 | awk -F '\"' '{print \$2}'", returnStdout: true).trim()
                        env.IMAGE_TAG = version
                        
                        def shortCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                        def buildName = "${version}-${shortCommit}"
                        echo "Setting build display name to ${buildName}"
                        currentBuild.displayName = buildName
                    } else {
                        // No new release - this commit doesn't have a tag
                        echo "No new release - commit does not have a release tag"
                        env.IS_NEW_RELEASE = 'false'
                        env.TRIGGER_GITOPS_CD = env.TRIGGER_GITOPS_CD_PARAM ?: 'false'
                        env.SKIP_IMAGE_PUSH = env.SKIP_IMAGE_PUSH_PARAM ?: 'true'
                        env.IMAGE_TAG = "v999.0.0-dev"
                        
                        def shortCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                        def buildName = "#${env.BUILD_NUMBER}-${shortCommit}"
                        echo "Setting build display name to ${buildName}"
                        currentBuild.displayName = buildName
                    }
                    
                    echo "Set TRIGGER_GITOPS_CD to: ${env.TRIGGER_GITOPS_CD}"
                    echo "Set SKIP_IMAGE_PUSH to: ${env.SKIP_IMAGE_PUSH}"
                    echo "Set IS_NEW_RELEASE to: ${env.IS_NEW_RELEASE}"
                    echo "Set IMAGE_TAG to: ${env.IMAGE_TAG}"
                }
            }
        }
        stage('Install Dependencies') {
            steps {
                dir("${FRONTEND_DIR}") {
                    sh 'npm i'
                }
                dir("${WORKSPACE}") {
                    sh '''
                    python3.13 -m venv backend/.venv
                    . backend/.venv/bin/activate
                    pip install --upgrade pip
                    pip install .[dev]
                    '''
                }
            }
        }

        stage('Build & Test') {
            parallel {
                stage('Backend') {
                    stages {
                        stage('Lint & Format') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    sh '''
                                    . .venv/bin/activate
                                    flake8 . --exclude=venv*,.venv*,__pycache__ --count --select=E9,F63,F7,F82 --show-source --statistics
                                    flake8 . --exclude=venv*,.venv*,__pycache__ --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
                                    isort --check-only . || true
                                    black --check --diff . || true
                                    '''
                                }
                            }
                        }
                        stage('Unit Tests') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    script {
                                        if (fileExists('tests') && sh(script: 'ls tests/test_*.py 2>/dev/null | wc -l', returnStdout: true).trim() != '0') {
                                            sh '. .venv/bin/activate && pytest'
                                        } else {
                                            echo 'No backend tests found, skipping.'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                stage('Frontend') {
                    stages {
                        stage('Lint & Format') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/eslint')) {
                                            sh 'npx eslint . || true'
                                        } else {
                                            echo 'No ESLint found, skipping lint.'
                                        }
                                        if (fileExists('node_modules/.bin/prettier')) {
                                            sh 'npx prettier --check . || true'
                                        } else {
                                            echo 'No Prettier found, skipping formatting check.'
                                        }
                                    }
                                }
                            }
                        }
                        stage('Unit Tests') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/jest')) {
                                            sh 'npx jest'
                                        } else {
                                            echo 'No frontend tests found, skipping.'
                                        }
                                    }
                                }
                            }
                        }
                        stage('Build') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    sh 'npm run build'
                                }
                            }
                        }
                    }
                }
            }
        }
 
        stage('Prepare .env') {
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
            steps {
                script {
                    writeFile file: '.env', text: """
ADMIN_USERNAME=${env.ADMIN_USERNAME}
ADMIN_PASSWORD_HASH=${env.ADMIN_PASSWORD_HASH}
ADMIN_SECRET_KEY=${env.ADMIN_SECRET_KEY}
POSTGRES_HOST=${env.POSTGRES_HOST}
POSTGRES_PORT=${env.POSTGRES_PORT}
POSTGRES_USER=${env.POSTGRES_USER}
POSTGRES_PASSWORD=${env.POSTGRES_PASSWORD}
POSTGRES_DATABASE=${env.POSTGRES_DATABASE}
""".stripIndent()
                }
            }
        }

        stage('Docker Build & Push') {
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
            steps {
                script {
                    sh "docker build -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG} . --build-arg VERSION=${env.IMAGE_TAG} --label=\"build_id=${env.BUILD_ID}\" --label=\"version=${env.IMAGE_TAG}\""
                    if (env.SKIP_IMAGE_PUSH != 'true') {
                        if(env.BRANCH_NAME == 'main') {
                            sh "docker tag ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG} ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                        }
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG}"
                    }
                    else {
                        echo 'Skipping Docker image push.'
                    }
                }
            }
        }

        stage('Deploy with GitOps (staging and prod)') {
            when {
                branch 'main'
                not { buildingTag() }
            }
            steps {
                script {
                    if (!env.GITOPS_REPO?.trim()) {
                        echo 'Skipping GitOps deployment because GITOPS_REPO is not set.'
                    } else if (env.TRIGGER_GITOPS_CD == 'true') {
                        sh 'rm -rf gitops-tmp'
                        sh "git clone ${env.GITOPS_REPO} gitops-tmp"
                        // staging bump
                        dir('gitops-tmp/k8s/overlays/staging') {
                            sh "kustomize edit set image ${env.DOCKER_REGISTRY}/${IMAGE_NAME}=${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG}"

                            // Generate new DB clone job for this version
                            echo "Creating database clone job for version ${env.IMAGE_TAG}"

                            def cloneJobFile = "db-clone-job-${env.IMAGE_TAG}.yaml"

                            sh "sed 's/VERSION_PLACEHOLDER/${env.IMAGE_TAG}/g' db-clone-job-template.yaml > ${cloneJobFile}"

                            try {
                                withCredentials([
                                    file(credentialsId: 'osmosmjerka-staging-kubeconfig', variable: 'KUBECONFIG_FILE')
                                ]) {
                                    withEnv([
                                        "CLONE_JOB_FILE=${cloneJobFile}",
                                        "CLONE_JOB_VERSION=${env.IMAGE_TAG}",
                                        "KUBE_NAMESPACE=osmosmjerka-staging",
                                        "PROD_DB_HOST=${env.POSTGRES_HOST}",
                                        "PROD_DB_PORT=${env.POSTGRES_PORT}",
                                        "PROD_DB_USER=${env.POSTGRES_USER}",
                                        "PROD_DB_PASSWORD=${env.POSTGRES_PASSWORD}",
                                        "PROD_DB_NAME=${env.POSTGRES_DATABASE}"
                                    ]) {
                                        sh '''
                                            set -euo pipefail
                                            trap 'rm -f "$CLONE_JOB_FILE"' EXIT

                                            export KUBECONFIG="$KUBECONFIG_FILE"

                                            # Ensure prod credentials secret is up to date
                                            kubectl create secret generic prod-db-access \
                                                --namespace "$KUBE_NAMESPACE" \
                                                --from-literal=PROD_DB_HOST="$PROD_DB_HOST" \
                                                --from-literal=PROD_DB_PORT="$PROD_DB_PORT" \
                                                --from-literal=PROD_DB_USER="$PROD_DB_USER" \
                                                --from-literal=PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
                                                --from-literal=PROD_DB_NAME="$PROD_DB_NAME" \
                                                --dry-run=client -o yaml | kubectl apply -f -

                                            # Delete any existing clone job first
                                            kubectl delete job -n "$KUBE_NAMESPACE" -l app.kubernetes.io/name=db-clone --ignore-not-found=true

                                            # Apply the new clone job
                                            kubectl apply -f "$CLONE_JOB_FILE"

                                            # Wait for clone job to complete (with timeout)
                                            echo "Waiting for database clone to complete..."
                                            kubectl wait --for=condition=complete --timeout=600s "job/clone-prod-to-staging-$CLONE_JOB_VERSION" -n "$KUBE_NAMESPACE" || {
                                                echo "Clone job timed out or failed, checking status..."
                                                kubectl describe job "clone-prod-to-staging-$CLONE_JOB_VERSION" -n "$KUBE_NAMESPACE"
                                                kubectl logs -l job-name="clone-prod-to-staging-$CLONE_JOB_VERSION" -n "$KUBE_NAMESPACE" --tail=50 || true
                                                exit 1
                                            }

                                            echo "Database clone completed successfully!"
                                        '''
                                    }
                                }
                            } finally {
                                // Safety cleanup in case the trap did not execute
                                sh "rm -f ${cloneJobFile}"
                            }

                            sh 'git config user.email "ci@example.com"'
                            sh 'git config user.name "CI Bot"'
                            sh 'git commit -am "osmosmjerka(staging): image ${IMAGE_TAG}" || echo \"No changes to commit\"'
                        }
                        dir('gitops-tmp') { sh 'git push' }
                        sh 'rm -rf gitops-tmp'
                    } else {
                        echo 'Skipping GitOps deployment.'
                    }
                }
            }
        }
    }
    post {
        always {
            script {
                // Cleanup: remove .env file, gitops temp dir, and node_modules/venv
                // Note: Docker images are kept for deployment, only temp files are cleaned
                sh 'rm -f .env || true'
                sh 'rm -rf gitops-tmp || true'
                sh 'rm -rf frontend/node_modules backend/.venv || true'
            }
            cleanWs()
        }
    }
}
