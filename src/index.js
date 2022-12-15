// minimist manages reading command line arguments
import parseArgs from 'minimist'

// Printable Text manages printing a txt file
import PrintableText from './PrintableText.js'

// scrape() manages retrieving contact data
import scrape from './scrape.js'

/*
  Start printing a txt file and scraping data
*/
const run = function() {
  // Get input file from command line arguments
  const args = parseArgs(process.argv.slice(2))

  if (!args || !args.input) {
    console.log('No input file passed, quitting.')
    return
  }

  // Create an instance of PrintableText with the letter txt
  const letter = new PrintableText(args.input)

  // Waiting period before scrapping starts, mostly so the letter
  // intro lines are visible without interruption
  const initialDelay = letter.getInitialDelay() + 3000

  // Start printing the letter
  letter.start()

  // Start scraping after the initial delay
  setTimeout(scrape, initialDelay)
}

// Go!
run()
