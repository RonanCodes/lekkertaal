export default {
  rules: {
    "subject-empty": [2, "never"],
    "type-empty": [0],
    "emoji-required": [2, "always"],
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\S+)\s(\w+)(?:\(([^)]+)\))?:\s(.+)$/,
      headerCorrespondence: ["emoji", "type", "scope", "subject"],
    },
  },
  plugins: [
    {
      rules: {
        "emoji-required": ({ emoji }) => [
          !!emoji && /\p{Emoji}/u.test(emoji),
          "First character must be an emoji (✨ 🐛 📝 🧪 🧹 ♻️ 🚀 🔧 ⚡ 🔒)",
        ],
      },
    },
  ],
};
