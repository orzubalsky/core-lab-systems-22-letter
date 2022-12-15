// chalk makes it easy to add style to terminal output
import chalk from 'chalk'

// fs handles interacting with the file system
import fs from 'fs'

// puppeteer automates a browser, either behind the scenes or by opening an actual browser window
import puppeteer from 'puppeteer'

// Wrap console.log in a function that adds chalk styling
const log = output => console.log(chalk.hex('#33').dim(`\t\t${output}`))

// Selectors for HTML elements on faculty pages
const selectors = {
  loadMore: '.m-workList__cta--ajax',
  cookieAccept: '#onetrust-accept-btn-handler',
  resultsContainer: '.m-contentList__results',
  facultyRow: '.a-contentBlock__link',
  facultyName: '.a-contentBlock__title',
  facultyTitle: '.a-contentBlock__body'
}

/*
  The faculty directory pages have a "load more" button. If you load one
  of the urls above and inspect the network activity and html elements on
  the page, you will see that everytime the "load more" button is pressed,
  a network request is made. The server responds with faculty data, which
  is then used to populate the page with additional html elements. After all
  data has been loaded, the "load more" button disappears.

  We want to start scrapping the data after we loaded all of the data into the page.
  For that, we have to know whether the "load more" button is visible.
*/
const isLoadMoreVisible = async function (puppeteerPage) {
  // Dynamic websites use some form of templates. Meaning, the same html elements
  // across different pages will have similar structure. The "load more" button
  // always has the same class. We use it to select the "load more" button element on the page.
  const selector = selectors.loadMore

  // Use a variable to keep track of whether the "load more" button is found.
  let isVisible = true

  // Wait up to 5 seconds for the "load more" button to appear. If it fails, meaning
  // the element cannot be found on the page, update our variable to denote that the
  // element is not visible.
  await puppeteerPage
    .waitForSelector(selector, { visible: true, timeout: 5000 })
    .catch(() => { isVisible = false })

  // Return the value of the variable, it will be either true or false.
  return isVisible
}

/*
  Load a faculty diretory page and perform all the async actions until all faculty
  data is loaded into the page
*/
const fullyLoadFacultyDirectoryPage = async function (puppeteerBrowser, url, school) {
  // Create a new page (like a new window or tab) with our automated browser.
  const page = await puppeteerBrowser.newPage()

  // Make our getSelectors() function available in the browser scope
  await page.exposeFunction('getSelectors', () => selectors)

  // Load a url in our page and wait for a signal telling us it's loaded
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 })

  // Wait for faculty items container element to appear (they are loaded async via a network request)
  await page.waitForSelector(selectors.resultsContainer)

  // Wait for the results page to load and display the results.
  await page.waitForSelector(selectors.facultyRow)

  // Check to see whether the "load more" button is visible
  let loadMoreVisible = await isLoadMoreVisible(page)

  // Click on "load more" until all rows are loaded
  while (loadMoreVisible) {
    await page.click(selectors.loadMore).catch(() => {})

    loadMoreVisible = await isLoadMoreVisible(page)
  }

  // Once all faculty rows are loaded, return the page object
  return page
}

/*
  Retrieve name, title, and individual profile page urls for each faculty
  in a given directory page
*/
const scrapeDirectoryPage = async function(puppeteerPage, school) {
  // Use a selector that matches all faculty rows
  const facultyRowSelector = selectors.facultyRow

  // Extract the results from the page.
  const data = await puppeteerPage.evaluate(async facultyRowSelector => {
    // The DOM nodes that are returned by querySelectorAll are not of type Array so cast them to an Array
    const results = [ ...document.querySelectorAll(facultyRowSelector) ]

    // Make our selectors available in the context of the browser
    const selectors = await getSelectors()

    // Create an object with individual faculty's name, title, and profile url for each html element
    return results.map(element => {
      // Get href value
      const href = element.getAttribute('href')

      // Construct the url for the profile page depending on if it's a relative or absolute url
      const url = href.indexOf("https://") >= 0
        ? href
        : `https://newschool.edu${href}`

      // Get the faculty's name from an inner html element
      const name = element.querySelector(selectors.facultyName) && element.querySelector(selectors.facultyName).innerHTML

      // Get the faculty's title from an inner html element
      const title = element.querySelector(selectors.facultyTitle) && element.querySelector(selectors.facultyTitle).innerHTML

      return { name, title, url }
    })
  }, facultyRowSelector)

  log(`Retrieved ${data.length} contacts from ${school}\n`)

  return data
}

/*
  Given a faculty directory page url: load it, get all contact info,
  and add the school's name to each individual contact
*/
const processDirectoryPage = async function(browser, url, school) {
  // Wait for a fully loaded page
  const puppeteerPage = await fullyLoadFacultyDirectoryPage(browser, url, school)

  // Scrape page for contact names and urls
  const results = await scrapeDirectoryPage(puppeteerPage, school)

  // Add school key / value
  const resultsWithSchool = results.map(contact => ({ ...contact, school }))

  // Close browser page
  puppeteerPage.close()

  return resultsWithSchool
}

/*
  Iterate over all faculty directory pages and process them
*/
const scrapeDirectories = async function(browser) {
  // URLs of each faculty directory page on the university website, as well as the school name.
  const directoryPages = [
    { school: 'Eugene Lang College of Liberal Arts', url: 'https://www.newschool.edu/lang/faculty/' },
    { school: 'Parsons School of Design', url: 'https://www.newschool.edu/parsons/faculty/' },
    { school: 'The New School for Social Research', url: 'https://www.newschool.edu/nssr/faculty/' },
    { school: 'Milano School of Policy, Management, and Environment', url: 'https://www.newschool.edu/milano/faculty/' },
    { school: 'Julien J. Studley Graduate Programs in International Affairs', url: 'https://www.newschool.edu/international-affairs/faculty/' },
    { school: 'School of Media Studies', url: 'https://www.newschool.edu/media-studies/faculty/' },
    { school: 'MFA Creative Writing', url: 'https://www.newschool.edu/writing/faculty' },
    { school: 'Bachelor\'s Program for Adults and Transfer Students', url: 'https://www.newschool.edu/bachelors-program/faculty/' },
  ]

  // An array to store all contact information
  let directoryData = []

  // Iterate over pages
  for (let i = 0; i < directoryPages.length; i++) {
    // Current item in loop
    const directoryPage = directoryPages[i]

    // Get all contact information from current page
    const pageData = await processDirectoryPage(browser, directoryPage.url, directoryPage.school)

    // Add contact information to the big data array
    directoryData = [ ...directoryData, ...pageData ]
  }

  return directoryData
}

/*
  Load an individual profile page url and get the email address from it
*/
const scrapeEmail = async (browser, url, name, status, currentCount, totalCount) => {
  log(`(${currentCount} of ${totalCount}) Retrieving email for ${status} Faculty ${name}`)

  // Wrap in a try/catch block so an error doesn't stop the whole script
  try {
    // Create a new browser page
    const page = await browser.newPage()

    // Load faculty profile url and wait for a loaded signal
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 })

    // Wait for contact details to appear
    const contactDetailsSelector = '.o-primaryContent__split'
    await page.waitForSelector(contactDetailsSelector)

    // Extract the email from the page.
    const email = await page.evaluate(contactDetailsSelector => {
      // Get the html element that has all contact details
      const result = document.querySelector(contactDetailsSelector)

      // Since the email address isn't in a separate html element,
      // find it based on a regular expression
      const emailMatches = result.innerHTML.match(/([a-zA-Z0-9._-]+@newschool\.edu)/)

      // If email is fount, return it, otherwise return null
      return emailMatches && emailMatches.length > 0 ? emailMatches[0] : null
    }, contactDetailsSelector)

    // Close the page
    page.close()

    return email
  } catch (e) {
    // log an error if it occurs
    log(`Error: ${e}`)
  }
}

/*
  Load emails for every contact item in an array
*/
const scrapeEmails = async function(browser, contactData) {
  log(`Starting to retrieve ${contactData.length} email addresses.`)

  // Array to store data in
  const data = []

  // Iterate over all contact data array
  for (let i = 0; i < contactData.length; i++) {
    // Current item
    const contact = contactData[i]

    // Faculty directory pages include both full time and part time faculty.
    // Determine part time / full time status based on the title
    const isPartTime = contact.title && contact.title.toLowerCase().indexOf('part-time') > -1

    // Assign one of two values so the data can be used easily later
    const status = isPartTime ? 'Part Time' : 'Full Time'

    // Retrieve the email from the profile page url
    const email = await scrapeEmail(browser, contact.url, contact.name, status, i + 1, contactData.length)

    // Add a new object to the data array that will have the existing fields (name, title, url, school)
    // with the additional email and status fields
    data.push({
      ...contact,
      email,
      status
    })
  }

  return data
}

/*
  Create a browser that scrapes all faculty contact data that's available on
  the university faculty pages
*/
const scrape = async function() {
  log('Starting process to retrieve faculty contact information\n')

  setTimeout(async () => {
    // Launch a browser instance in the background. We will use this browser
    // to load different web pages.
    const browser = await puppeteer.launch({
      headless: true
    })

    // First get all names and individual page urls from the different directories
    const directoryData = await scrapeDirectories(browser)

    // Then go through each of the urls that were retrieved and get email addresses
    const contactData = await scrapeEmails(browser, directoryData)

    // Close the browser instance
    await browser.close()

    // Write all of the data to a JSON file
    fs.writeFileSync(`output/tns_faculty_contacts.json`, JSON.stringify(contactData, null, 4))
  }, 3000)
}

export default scrape
