# CHANGELOG

<!-- version list -->

## v1.6.0 (2025-07-28)

### Feature

- Display progress circles for uploading and clearing database, improve file upload performance,
  resolve minor issues with category filtering and index reset
  ([#35](https://github.com/bartekmp/osmosmjerka/pull/35),
  [`447e027`](https://github.com/bartekmp/osmosmjerka/commit/447e0277f7b19f51b93b58b5b0956e85f4718b7c))


## v1.5.2 (2025-07-28)

### Enhancement

- Add unit tests for pdf and png exports
  ([`b938018`](https://github.com/bartekmp/osmosmjerka/commit/b9380186db65db08c8c3b4cc919c63772ad218c8))


## v1.5.1 (2025-07-28)

### Enhancement

- Freeze requirements
  ([`9dd3ca1`](https://github.com/bartekmp/osmosmjerka/commit/9dd3ca12d16cad4d6d2d0a578bac613b0e9955af))


## v1.5.0 (2025-07-28)

### Feature

- Move to postgresql, add new export formats - pdf and png
  ([#34](https://github.com/bartekmp/osmosmjerka/pull/34),
  [`888912c`](https://github.com/bartekmp/osmosmjerka/commit/888912c823c956b16b2942f62f8ad5c9c9acc9d2))


## v1.4.1 (2025-07-26)

### Bug Fixes

- Grid rightmost column overflow on mobile ([#32](https://github.com/bartekmp/osmosmjerka/pull/32),
  [`b60842e`](https://github.com/bartekmp/osmosmjerka/commit/b60842e30aa1fdea4a97ded60801dce5bff72adc))

- Night mode button position in various display modes
  ([#32](https://github.com/bartekmp/osmosmjerka/pull/32),
  [`b60842e`](https://github.com/bartekmp/osmosmjerka/commit/b60842e30aa1fdea4a97ded60801dce5bff72adc))


## v1.4.0 (2025-07-25)

### Feature

- Add day/night toggle switch, create night mode style
  ([#31](https://github.com/bartekmp/osmosmjerka/pull/31),
  [`a57f56e`](https://github.com/bartekmp/osmosmjerka/commit/a57f56eabe1f615aceead46b3346b26bba999a70))

- Logo changing colors easter egg ([#31](https://github.com/bartekmp/osmosmjerka/pull/31),
  [`a57f56e`](https://github.com/bartekmp/osmosmjerka/commit/a57f56eabe1f615aceead46b3346b26bba999a70))


## v1.3.0 (2025-07-25)

### Bug Fixes

- Pull the entire repo for semantic releasing
  ([`756fbf0`](https://github.com/bartekmp/osmosmjerka/commit/756fbf0b124c958a8ce93ee91edb75e8ee89f7d7))

### Feature

- Add a button to collapse the controls on mobile screen
  ([#30](https://github.com/bartekmp/osmosmjerka/pull/30),
  [`8636d25`](https://github.com/bartekmp/osmosmjerka/commit/8636d2512a54fa88456585209b78c355190dbd0c))

- Optimize layout on small displays ([#30](https://github.com/bartekmp/osmosmjerka/pull/30),
  [`8636d25`](https://github.com/bartekmp/osmosmjerka/commit/8636d2512a54fa88456585209b78c355190dbd0c))


## v1.2.0 (2025-07-25)

### Feature

- Change the buttons to emoji-only on narrow displays
  ([#29](https://github.com/bartekmp/osmosmjerka/pull/29),
  [`f9ccd63`](https://github.com/bartekmp/osmosmjerka/commit/f9ccd6302ea8ff9dafd0dfa74988f436ac5a9ed4))

- Make the layout more readable on smaller screens
  ([#29](https://github.com/bartekmp/osmosmjerka/pull/29),
  [`f9ccd63`](https://github.com/bartekmp/osmosmjerka/commit/f9ccd6302ea8ff9dafd0dfa74988f436ac5a9ed4))


## v1.1.3 (2025-07-24)

### Bug Fixes

- Restore touch controls on mobile after introducing MUI
  ([#28](https://github.com/bartekmp/osmosmjerka/pull/28),
  [`30080a6`](https://github.com/bartekmp/osmosmjerka/commit/30080a603d96bca319c74beb9cb01eef2811e525))


## v1.1.2 (2025-07-24)

### Bug Fixes

- Remove leftover emoji from translation button
  ([`82681fd`](https://github.com/bartekmp/osmosmjerka/commit/82681fd7061aa2ea32430ffd301365a39a64924f))


## v1.1.1 (2025-07-24)

### Bug Fixes

- Wrong DB file path
  ([`e1f19af`](https://github.com/bartekmp/osmosmjerka/commit/e1f19af96e79a347c0823be983b2e0f01deb00d8))


## v1.1.0 (2025-07-24)

### Feature

- Allow editing rows inline in the admin panel page
  ([#27](https://github.com/bartekmp/osmosmjerka/pull/27),
  [`1554bcc`](https://github.com/bartekmp/osmosmjerka/commit/1554bccfd013b153a2e48d9359abbab8c613df83))

- Use Material UI framework instead of raw CSS styling, use themes
  ([#27](https://github.com/bartekmp/osmosmjerka/pull/27),
  [`1554bcc`](https://github.com/bartekmp/osmosmjerka/commit/1554bccfd013b153a2e48d9359abbab8c613df83))


## v1.0.6 (2025-07-22)

### Bug Fixes

- Dockerfile paths
  ([`bc820fc`](https://github.com/bartekmp/osmosmjerka/commit/bc820fc7b49498d27e302877dd8b419fd3882c51))


## v1.0.5 (2025-07-22)

### Bug Fixes

- Remove default variable value from Jenkinsfile
  ([`832157f`](https://github.com/bartekmp/osmosmjerka/commit/832157f1c0529d56ebce7f080238589d619e8d57))


## v1.0.4 (2025-07-22)

### Bug Fixes

- Image push skip
  ([`a06f21a`](https://github.com/bartekmp/osmosmjerka/commit/a06f21a21c79c5f521bc899ab86e5b000eafb13a))


## v1.0.3 (2025-07-22)

### Bug Fixes

- Invalid conditional in jenkinsfile
  ([`bf9cadc`](https://github.com/bartekmp/osmosmjerka/commit/bf9cadc907115a3948cd2b7bef015d325d3c99e7))


## v1.0.2 (2025-07-22)

### Bug Fixes

- Jenkinsfile inverted logic
  ([`bd52acd`](https://github.com/bartekmp/osmosmjerka/commit/bd52acd3c92fe2cc87aced3825b624fdf6fe9999))


## v1.0.1 (2025-07-22)

### Bug Fixes

- Refactor dockerfile
  ([`7ca3b03`](https://github.com/bartekmp/osmosmjerka/commit/7ca3b032bd7401d09700b2aea2016d4413802886))

- Reset versioning
  ([`a540b5d`](https://github.com/bartekmp/osmosmjerka/commit/a540b5d975eb1f90632b3efceebc2220797da783))

- Trigger image build
  ([`510f97f`](https://github.com/bartekmp/osmosmjerka/commit/510f97f23cc09256b16ea636ee8feaa3b8ee9bdf))

- Wrong jenkinsfile gitops variable
  ([`2520f0e`](https://github.com/bartekmp/osmosmjerka/commit/2520f0eb4af5cecc0f1200553e3871ff447d979e))


## v1.0.0 (2025-07-22)

- Initial Release
