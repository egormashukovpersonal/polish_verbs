require "json"
require "csv"
require "httparty"
require "dotenv/load"
require "set"

API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4.1"

verbs = [
  "być",
  "mieć",
  "robić",
  "mówić",
  "iść",
  "widzieć",
  "dać",
  "chcieć",
  "wiedzieć",
  "musieć",

  "brać",
  "stać",
  "myśleć",
  "patrzeć",
  "słuchać",
  "pracować",
  "jeść",
  "pić",
  "mieszkać",
  "żyć",

  "kochać",
  "lubić",
  "czuć",
  "wierzyć",
  "szukać",
  "znaleźć",
  "otwierać",
  "zamykać",
  "sięgać",
  "trzymać",

  "prowadzić",
  "jechać",
  "wracać",
  "wychodzić",
  "wchodzić",
  "przychodzić",
  "zostawać",
  "spotykać",
  "poznawać",
  "uczyć",

  "uczyć się",
  "czytać",
  "pisać",
  "liczyć",
  "rozumieć",
  "zapominać",
  "pamiętać",
  "pytać",
  "odpowiadać",
  "prosić",

  "dawać",
  "odbierać",
  "kupować",
  "sprzedawać",
  "płacić",
  "zarabiać",
  "oszczędzać",
  "wydawać",
  "brać udział",
  "decydować",

  "planować",
  "zmieniać",
  "zaczynać",
  "kończyć",
  "próbować",
  "udawać",
  "wydarzyć się",
  "dziać się",
  "tworzyć",
  "niszczyć",

  "budować",
  "naprawiać",
  "psuć",
  "otaczać",
  "chronić",
  "atakować",
  "bronić",
  "walczyć",
  "wygrywać",
  "przegrywać",

  "biec",
  "chodzić",
  "lecieć",
  "latać",
  "pływać",
  "siedzieć",
  "stać",
  "leżeć",
  "spać",
  "budzić się",

  "myć",
  "ubierać",
  "rozbierać",
  "gotować",
  "sprzątać",
  "czyścić",
  "otwierać się",
  "zamykać się",
  "śmiać się",
  "bać się"
]

DEST_DATA_FILE   = "data/result.json"

def generate_for_chatgpt(words)
  prompt = <<~PROMPT
    Я учу польские глаголы.

    Я дам тебе список глаголов, а ты вернёшь JSON.

    Верни ТОЛЬКО JSON-массив объектов. Без текста, без markdown.

    Каждый объект должен иметь СТРОГО такую структуру:

    {
      "polish_word": "",
      "russian": "",

      "present": {
        "ja": "",
        "ty": "",
        "on": "",
        "ona": "",
        "ono": "",
        "my": "",
        "wy": "",
        "oni": "",
        "one": ""
      },

      "past": {
        "masculine": {
          "ja": "",
          "ty": "",
          "on": "",
          "my": "",
          "wy": "",
          "oni": ""
        },
        "feminine": {
          "ja": "",
          "ty": "",
          "ona": "",
          "my": "",
          "wy": "",
          "one": ""
        },
        "neuter": {
          "ono": ""
        }
      },

      "future": {
        "masculine": {
          "ja": "",
          "ty": "",
          "on": "",
          "my": "",
          "wy": "",
          "oni": ""
        },
        "feminine": {
          "ja": "",
          "ty": "",
          "ona": "",
          "my": "",
          "wy": "",
          "one": ""
        },
        "neuter": {
          "ono": ""
        }
      },

      "conditional": {
        "masculine": {
          "ja": "",
          "ty": "",
          "on": "",
          "my": "",
          "wy": "",
          "oni": ""
        },
        "feminine": {
          "ja": "",
          "ty": "",
          "ona": "",
          "my": "",
          "wy": "",
          "one": ""
        },
        "neuter": {
          "ono": ""
        }
      },

      "imperative": {
        "ty": "",
        "my": "",
        "wy": ""
      }
    }

    Правила:
    - Используй ТОЛЬКО глаголы из списка
    - НЕ добавляй новые слова
    - НЕ меняй глаголы
    - Все формы должны быть реальными польскими формами
    - Если глагол несовершенный — future делай через "będę + infinitive"
    - Если совершенный — обычное будущее
    - Никаких null, все поля должны быть заполнены строками

    Вот список глаголов:
    #{words.join(", ")}
    PROMPT

  response = HTTParty.post(
    API_URL,
    headers: {
      "Authorization" => "Bearer #{ENV['OPENAI_API_KEY']}",
      "Content-Type"  => "application/json"
    },
    body: {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    }.to_json
  )

  content = response.dig("choices", 0, "message", "content")
  JSON.parse(content)
end

words = verbs

puts "Загружено слов: #{words.size}"

result_data =
  if File.exist?(DEST_DATA_FILE)
    JSON.parse(File.read(DEST_DATA_FILE))
  else
    []
  end

CHUNK_SIZE = 1
MAX_RETRIES = 5
RETRY_SLEEP = 5 # секунд

processed_chunks = (result_data.size.to_f / CHUNK_SIZE).floor

words.each_slice(CHUNK_SIZE).with_index do |chunk, index|
  next if index < processed_chunks

  retries = 0

  begin
    puts "→ Step #{index + 1} | total words: #{result_data.size}"

    generated = generate_for_chatgpt(chunk)

    # страховка от дублей
    existing = result_data.map { |w| w["polish_word"].downcase }.to_set
    generated.reject! { |w| existing.include?(w["polish_word"].downcase) }

    result_data.concat(generated)

    File.write(
      DEST_DATA_FILE,
      JSON.pretty_generate(result_data, ensure_ascii: false)
    )

    sleep 1.5

  rescue Net::ReadTimeout, Timeout::Error, Errno::ECONNRESET => e
    retries += 1
    puts "⏳ Timeout в чанке #{index + 1}, попытка #{retries}/#{MAX_RETRIES}"

    if retries <= MAX_RETRIES
      sleep RETRY_SLEEP * retries # backoff
      retry
    else
      puts "❌ Превышено число повторов в чанке #{index + 1}"
      break
    end

  rescue JSON::ParserError => e
    puts "❌ Некорректный JSON в чанке #{index + 1}: #{e.message}"
    break

  rescue => e
    puts "❌ Фатальная ошибка в чанке #{index + 1}: #{e.class} — #{e.message}"
    break
  end
end


puts "✅ Готово. Итоговых слов: #{result_data.size}"
