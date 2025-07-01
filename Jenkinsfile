pipeline {
    agent any

    parameters {
        string(name: 'DOCKER_REGISTRY', defaultValue: '', description: 'Docker registry address, e.g. my-rtegistry.com:123')
    }

    environment {
        IMAGE_NAME = "osmosmjerka"
        BACKEND_DIR = "backend"
        FRONTEND_DIR = "frontend"
        VERSION_FILE = "VERSION"
    }

    stages {
        stage('Read Version') {
            steps {
                script {
                    VERSION = readFile("${VERSION_FILE}").trim()
                    env.IMAGE_TAG = VERSION
                }
            }
        }

        stage('Build & Test') {
            parallel {
                stage('Backend') {
                    stages {
                        stage('Setup Python') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    sh 'python3 -m venv .venv'
                                    sh '. .venv/bin/activate && pip install --upgrade pip'
                                    sh '. .venv/bin/activate && pip install .[dev]'
                                }
                            }
                        }
                        stage('Lint & Format') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    sh '. .venv/bin/activate && black --check .'
                                    sh '. .venv/bin/activate && isort --check-only .'
                                }
                            }
                        }
                        stage('Unit Tests') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    script {
                                        if (fileExists('tests') && sh(script: 'ls tests/test_*.py 2>/dev/null | wc -l', returnStdout: true).trim() != "0") {
                                            sh '. .venv/bin/activate && pytest'
                                        } else {
                                            echo "No backend tests found, skipping."
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                stage('Frontend') {
                    stages {
                        stage('Install Node Modules') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    sh 'npm ci || npm install'
                                }
                            }
                        }
                        stage('Lint & Format') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/eslint')) {
                                            sh 'npx eslint . || true'
                                        } else {
                                            echo "No ESLint found, skipping lint."
                                        }
                                        if (fileExists('node_modules/.bin/prettier')) {
                                            sh 'npx prettier --check . || true'
                                        } else {
                                            echo "No Prettier found, skipping formatting check."
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
                                            echo "No frontend tests found, skipping."
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

        stage('Docker Build & Push') {
            steps {
                script {
                    sh "docker build -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ."
                    sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                    sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}