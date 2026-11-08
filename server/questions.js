// Question decks per challenge type.
// Every card talks to the player whose turn it is ("you"); {partner} is replaced with the other player's name.
// Guess questions are about the partner: the player who landed guesses, the partner has the real answer.
module.exports = {
  love: [
    "What do you love most about {partner}?",
    "Describe your first date with {partner} ❤️",
    "What's one little thing {partner} does that makes you smile?",
    "When did you first realise you liked {partner}?",
    "What's your favourite photo of you and {partner}, and why?",
    "Describe {partner} in three words.",
  ],
  dare: [
    "Send {partner} a voice note 😈",
    "Say something romantic to {partner}",
    "Sing one line of your song with {partner} 🎤",
    "Do your best impression of {partner}",
    "Show {partner} the last photo in your gallery",
    "Make up a poem for {partner} right now and text it",
  ],
  memory: [
    "What's your best memory with {partner}?",
    "When did you miss {partner} the most?",
    "What's the funniest thing that happened to you and {partner}?",
    "What was your first impression of {partner}?",
    "Which trip or outing with {partner} would you relive?",
    "What's a small moment with {partner} you never forgot?",
  ],
  gift: [
    "Plan a little surprise for {partner} 🎁",
    "Send {partner} a cute pic",
    "Promise {partner} a date idea for next week",
    "Tell {partner} a gift you'd love to give them",
    "Write {partner} a 2-line love note",
    "Share a song with {partner} that reminds you of them",
  ],
  guess: [
    "What's {partner}'s favourite food?",
    "Where would {partner} go on a dream trip?",
    "What's {partner}'s biggest pet peeve?",
    "What would {partner} order at a café?",
    "What's {partner}'s favourite movie or show?",
    "What's {partner}'s comfort activity after a long day?",
    "What was {partner}'s childhood dream job?",
    "Which emoji does {partner} use the most?",
  ],
  timed: [
    "Name 10 things you love about {partner}",
    "Give {partner} 5 compliments without repeating a word",
    "Draw a portrait of {partner} and show it",
    "List 8 places you and {partner} have been together",
    "Do 10 squats while saying 'I love you, {partner}' each time",
    "Name 6 of {partner}'s favourite things",
  ],
  together: [
    "Both of you: say what you're grateful for today 🙏",
    "Plan your next date together right now 📅",
    "Take a selfie together (or a video-call screenshot) 📸",
    "Both share your favourite memory of this month",
    "Pick a song and sing the chorus together 🎶",
    "Each say one thing you want to do together this year",
  ],
};
