class ToolBridge < Formula
  desc "CLI for discovering and invoking tools through Tool Bridge"
  homepage "https://github.com/TokenRollAI/tool-bridge"
  url "https://registry.npmjs.org/@tool-bridge/cli/-/cli-0.32.0.tgz"
  sha256 "9816a5471764952ab56dfe158b783c7a7d6beb001977e9e93fd8e85de1c2c122"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/tb --version")

    ENV["XDG_CONFIG_HOME"] = testpath/"config"
    config = testpath/"config/tool-bridge/config.json"
    config.write JSON.generate(
      current:  "first",
      profiles: {
        first:  { baseUrl: "https://first.invalid", sk: "test-first" },
        second: { baseUrl: "https://second.invalid", sk: "test-second" },
      },
    )

    listed = JSON.parse(shell_output("#{bin}/tb use --json"))
    assert_equal "first", listed.fetch("current")
    assert_equal ["first", "second"], listed.fetch("profiles")

    switched = JSON.parse(shell_output("#{bin}/tb use second --json"))
    assert_equal true, switched.fetch("ok")
    assert_equal "second", switched.fetch("current")
    assert_equal "second", JSON.parse(config.read).fetch("current")

    listed = JSON.parse(shell_output("#{bin}/tb use --json"))
    assert_equal "second", listed.fetch("current")
  end
end
