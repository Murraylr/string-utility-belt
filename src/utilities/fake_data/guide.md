---
title: Fake Data Generator Online — Mock Names & Rows
description: Generate realistic fake test data online — names, emails, addresses, credit cards and full rows — as lines, CSV or JSON, reproducible with a seed.
---
## What is a fake data generator?

A fake data generator (in the tradition of tools like Faker.js or Mockaroo) produces realistic-looking but entirely made-up values — names, emails, addresses, phone numbers, and more — for populating test databases, demos, and UI mockups without using anyone's real information. Where a collision with something real could cause harm, values are built to avoid one: email and URL domains all end in `.example` (the top-level domain [reserved by RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606) specifically so it can never be registered), phone numbers use the `555-0100`–`555-0199` block reserved in North America for fictional use, and generated MAC addresses have their locally-administered bit set so they can never match a real hardware vendor's address range. Other fields are simply random picks — names are common real names, and IPv4 addresses and street addresses can coincide with real ones.

## How it works

Pick a `type` and a `count`, and the tool generates that many values:

```example
title: three seeded names, one per line
input:
params: {"type": "name", "count": 3, "seed": 42}
output: Chloe Clark
Julian Green
Mia Young
```

The `row` type returns a full record instead of a single field — useful for populating an entire test table at once:

```example
title: a full row of fake data as json
input:
params: {"type": "row", "count": 1, "format": "json", "seed": 7}
output: [
  {
    "id": 1,
    "firstName": "Olivia",
    "lastName": "Brown",
    "email": "olivia.brown@fincordfinance.example",
    "username": "obrown521",
    "phone": "+1 (310) 555-0146",
    "address": "2400 Jefferson Way, Bristol, DE 76607",
    "city": "Oakland",
    "country": "Germany",
    "company": "Fourth Coffee",
    "jobTitle": "HR Coordinator",
    "url": "https://tailspintoys.example/ad-aperiam",
    "ipv4": "196.48.36.40",
    "date": "2009-07-24",
    "price": "$75.43"
  }
]
```

Emails are built from a generated first and last name (sometimes with a number appended) plus one of the reserved example domains:

```example
title: seeded emails
input:
params: {"type": "email", "count": 2, "seed": 12345}
output: violet.jackson@woodgrovebank.example
ella.lee@fabrikam.example
```

A count of zero with `csv` format still returns just the header row for the requested type, rather than an empty string:

```example
title: a count of zero still returns the csv header
input:
params: {"count": 0, "format": "csv", "type": "email"}
output: email
```

## Options

- **type** — what kind of value to generate. Scalar types: `name`, `first-name`, `last-name`, `email`, `username`, `phone`, `address`, `city`, `country`, `company`, `job-title`, `sentence`, `url`, `domain`, `ipv4`, `mac`, `date`, `price`, `credit-card`. The `row` type instead returns a full record with `id`, `firstName`, `lastName`, `email`, `username`, `phone`, `address`, `city`, `country`, `company`, `jobTitle`, `url`, `ipv4`, `date`, and `price` fields together.
- **count** — how many values (or rows) to generate; default `5`, from 0 to 10,000.
- **format** — `lines` (default, one value per line, or one row per line as a CSV-style record without a header), `csv` (a proper header row followed by one line per value or row, with fields containing commas or quotes automatically quoted), or `json` (an array of strings, or an array of row objects).
- **separator** — what joins the lines; default `\n`. Typing `\n`, `\r`, or `\t` in this field is interpreted as the actual control character, since a plain text field cannot hold a literal newline.
- **seed (0 = random)** — `0` (the default) produces fresh, different data on every run. Any other integer seeds a small deterministic PRNG and reproduces the exact same data every time, which is what makes the examples on this page repeatable and is useful for stable test fixtures.

## Common uses

- Seeding a development database or demo environment with realistic-looking records.
- Generating fixture data for automated tests, with a fixed seed so the same test data is produced on every run.
- Filling in placeholder rows in a mockup or a CSV template before real data is available, alongside [lorem ipsum](/util/lorem_ipsum/) for body text.

## Tips and pitfalls

- Generated credit card numbers pass the Luhn checksum and use brand-like prefixes (Visa, Mastercard, Discover, Amex), so they behave correctly against basic format validation — but they are random numbers, not issued cards, and not the official test numbers that payment sandboxes recognize.
- In a `row`, the `email` and `username` are built from that row's `firstName`/`lastName`, but the other fields are generated independently — in the example above, `city` does not match the city inside `address`.
- This tool ignores its actual text input — the input box has no effect on the generated data.
- To generate matching unique identifiers (a primary key, a UUID) for the rows this tool produces, see [uuid](/util/uuid/) or [ulid](/util/ulid/); to turn the JSON output into a table, see [json to csv](/util/json_to_csv/).
