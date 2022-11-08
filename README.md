# Trade-A-Plane (tap)

**tap** is a NodeJS command-line interface to the [Trade-A-Plane](https://www.trade-a-plane.com/) advanced search engine page.

This tool is used to dump Trade-A-Plane listings for off-line analysis. It's primary output format is [ndjson](http://ndjson.org/)
format allowing clients to create well-formatted datasets.

# Requirements

Any platform that supports [NodeJS](https://nodejs.org) shoud be able to run **tap** without issue.

# Install

```
$ npm install
```

# Trade-A-Plane Search Design

Trade-A-Plane's search engine API is performed by posting URL encoded parameters to the site's `/search` endpoint.

The `/search` endpoint in turn returns an HTML document that contains listing ids with basic information about each
classified ad. These entries are what **tap** returns by default.

The listing id themselves though can be individually fetched which will return a more detailed document about each
aircraft. These entries can be fetched in addition to the basic ones outlined above in `--deep` mode. See below.

Because the site employs strict rate-limiting to one request per IP, all `/search` requests are done sychronously
with a simple backoff algorithm that has been tested extensively to guaranteed result delivery.

Trade-A-Plane's search taxonomy is subdivided into two *category levels*:

* Level 1 are makes (e.g. CESSNA, PIPER, BEECHCRAFT)
* Level 2 are model groups (e.g. CESSNA 172 SERIES, PIPER CHEROKEE PA28 SERIES, BEECHCRAFT 35 BONANZA SERIES)

These *category levels* can be used with **tap's** `search` command to fetch specific makes and model groups as needed.
You can also search for an individual model within a model group (e.g. 172Ns within the CESSNA 172 SERIES grouping).

# Usage

**tap** attempts to replicate all the major search options Trade-a-Plane's web interface offers.

Let's walk through an example which showcases how to use **tap**. It is highly recommend you download and install the
[./jq](https://stedolan.github.io/jq/) JSON query tool to explore **tap's** output format.

First, let's dump all the single-engine makes Trade-A-Plane knows about:

```
$ node tap category
170PPM
3XTRIM AIRCRAFT FACTORY
AERO COMMANDER
...
ZENAIR/ZENITH
```

If instead you wanted to find all the makes for turboprops then:

```
$ node tap category --type "Turboprop"
AERO COMMANDER
...
VELOCE PLANES
```

To find model groups, specify *category level 2* like so:

```
$ node tap category -l 2
...
CESSNA 172 SERIES
CESSNA 175 SERIES
CESSNA 177 SERIES
...
```

Now, let's say we are shopping for a Cardinal (CESSNA 177 SERIES).

Let's dump all the 177 listings:

```
$ node tap search --model-group "CESSNA 177 SERIES" | jq .
{
  "id": "2405138",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "65012",
  "title": "1967 CESSNA 177 / 180 CONVERSION",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177 %2F 180 CONVERSION",
  "type": "aircraft",
  "year": "1967",
  "price": "$79,900",
  "registration": "N2841X",
  "total_time": "1561",
  "address": "Little River, CA USA",
  "last_updated": "08/01/2022",
  "fetch_date": 1667869989895
}
{
  "id": "2411439",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "46314",
  "title": "1974 CESSNA 177B",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177B",
  "type": "aircraft",
  "year": "1974",
  "price": "$37,900",
  "registration": "N34845",
  "total_time": "Not Listed",
  "address": "Bangor, ME USA",
  "last_updated": "10/26/2022",
  "fetch_date": 1667869989895
}
...
```

These are basic listings. If we add the `--deep` option to **tap's** `search` command, **tap** will scrape the entire listing's
text:

```
$ node tap search --model-group "CESSNA 177 SERIES" --deep | jq .
{
  "id": "2402154",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "71282",
  "title": "1977 CESSNA 177RG",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177RG",
  "type": "aircraft",
  "year": "1977",
  "price": "$289,000",
  "registration": "C-GCUS",
  "total_time": "2793",
  "address": "Grassie, ON CAN",
  "last_updated": "08/21/2022",
  "fetch_date": 1667870112214,
  "specs": "Total Time:2793Engine 1 Time:142 SFRMUseful Load:1052 lbCondition:UsedYear Painted:2010Interior Year:2021Flight Rules:BTH# of Seats:4",
  "description": "Offered at $289,000 USD. All serious offers will be considered at this price-point going forward. Contact dylan@canadianaircraftbrokers.com for a viewing or to schedule a test flight.\n\nThis Cessna 177RG Cardinal is an incredibly rare find. Fully loaded, no expense spared and the attention to detail is unmatched with any other C177RG. This is a turn-key IFR aircraft equipped with the best avionics available to General Aviation pilots. \n\nCessna 177 Cardinal lovers and first time owners alike will love the upgrades done on this aircraft. The enhanced situational awareness provided by the Garmin G3X PFD & MFD along with the Garmin GFC 500 Autopilot with Electronic Stability and Protection (ESP) makes this aircraft a safe and comfortable VFR or IFR long distance flyer. \n\nThe aircraft is powered by the IO-360-A1B6D upgraded with the Powerflow Exhaust System and GAMI Injectors. The MT 3 Blade Propeller (MTV-9-B) provides a uniquely quiet ride with cabin vibration drastically reduced.\n\nThis aircraft brings economy, comfort and capability with its enhanced IFR Garmin Avionics suite.\n\nThis Cessna 177RG is truly one of a kind!\n\nEmail: dylan@canadianaircraftbrokers.com",
  "avionics": "Garmin G3X PFD (10\" Touch Screen) & MFD (7\" Touch Screen)\n\nGarmin GMA 350C Audio Panel\n\nGarmin GNC 355 GPS/COMM\n\nGarmin GTN 650Xi (WAAS) GPS.\n\nGarmin G5 Standby Attitude Indicator \n\nEquipped with the GA35 WAAS Antenna with Garmin GDL 51R SiriusXM Weather Data.\n\nGarmin GMA 350C Audio Panel\n\nGarmin GFC 500 Autopilot with Electronic Stability Protection (ESP)\n\nGTX 354 Transponder (ADS-B In/Out)\n\nFlight Stream 510 patented Wi-Fi® and Bluetooth®-enabled MultiMediaCard (MMC)\n\nE-04 406 ELT",
  "airframe": "1977 Cessna 177RG\n\nGross Weight: 2,800 Lbs.\nTTSN: 2850",
  "engine": "Lycoming IO-360-A1B6D\n\nPowerflow Exhaust System New March 2021 (STC SA03623AT) \n\nGAMI Injectors New March 2021 (STC SE09445SC) \n\nCiES FUEL SENDERS L & R New March 2021 (STC SA02511SE)\n\nPropeller: 50 SNEW (June 2022)\nMT 3 Blade Propeller MTV-9-B",
  "int_ext": "Avion Research Control Yokes (STC SA0779LA)\n\nLED Position, Strobe Lights, Beacon and Taxi/Landing Lights (STC SA01827WI)\n\nInterior completely refurbished in March of 2021. Black leather seats, carpets and side panels as well as headliners.",
  "remarks": "Truly a remarkable C177RG. A technologically infused classic aircraft, great for IFR pilots."
}
...
```

But you want a 177 with the 180hp Lycoming engine which was made in the 1970s. You can specify a `year` range then:

```
$ node tap search --model-group "CESSNA 177 SERIES" --year 1970-1978
{
  "id": "2411666",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "81451",
  "title": "1970 CESSNA 177B",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177B",
  "type": "aircraft",
  "year": "1970",
  "price": "$125,000",
  "registration": "N30765",
  "total_time": "4731",
  "address": "Van Nuys Airport, CA USA",
  "last_updated": "11/01/2022",
  "fetch_date": 1667870259918
}
{
  "id": "2411439",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "46314",
  "title": "1974 CESSNA 177B",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177B",
  "type": "aircraft",
  "year": "1974",
  "price": "$37,900",
  "registration": "N34845",
  "total_time": "Not Listed",
  "address": "Bangor, ME USA",
  "last_updated": "10/26/2022",
  "fetch_date": 1667870259918
}
...
```

And you wanted them sorted by `price`, and in descending order:

```
$ node tap search --model-group "CESSNA 177 SERIES" --year 1970-1978 --sort price --sort-order desc | jq .
{
  "id": "2402154",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "71282",
  "title": "1977 CESSNA 177RG",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177RG",
  "type": "aircraft",
  "year": "1977",
  "price": "$289,000",
  "registration": "C-GCUS",
  "total_time": "2793",
  "address": "Grassie, ON CAN",
  "last_updated": "08/21/2022",
  "fetch_date": 1667870325961
}
{
  "id": "2409408",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "79156",
  "title": "1972 CESSNA 177RG",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177RG",
  "type": "aircraft",
  "year": "1972",
  "price": "$189,995",
  "registration": "N1880Q",
  "total_time": "2899",
  "address": "Merritt Island, FL, FL USA",
  "last_updated": "09/06/2022",
  "fetch_date": 1667870325961
}
...
```

But you want 177RGs specifically:

```
$ node tap search --model 177RG --model-group "CESSNA 177 SERIES" --year 1970-1978 --sort price --sort-order | jq .
{
  "id": "2402154",
  "model_group": "CESSNA 177 SERIES",
  "seller_id": "71282",
  "title": "1977 CESSNA 177RG",
  "category": "Single Engine Piston",
  "make": "CESSNA",
  "model": "177RG",
  "type": "aircraft",
  "year": "1977",
  "price": "$289,000",
  "registration": "C-GCUS",
  "total_time": "2793",
  "address": "Grassie, ON CAN",
  "last_updated": "08/21/2022",
  "fetch_date": 1667870495240
}
...
```

Use `node tap search --help` to see all of its options.

# Creating Datasets

If you dump a large subset or even all of the listings from Trade-A-Plane using **tap** then you can easily create well-formed
JSON datasets using `jq` like so:

```
$ node tap search > output.json
$ jq . -s output.json > dataset.json
$ python3
Python 3.9.2 (default, Feb 28 2021, 17:03:44)
[GCC 10.2.1 20210110] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import pandas as pd
>>> df = pd.read_json('dataset.json')
>>> df.iloc[0]
id                           2402154
model_group        CESSNA 177 SERIES
seller_id                      71282
title              1977 CESSNA 177RG
category        Single Engine Piston
make                          CESSNA
model                          177RG
type                        aircraft
year                            1977
price                       $289,000
registration                  C-GCUS
total_time                      2793
address              Grassie, ON CAN
last_updated              08/21/2022
fetch_date             1667870741694
Name: 0, dtype: object
```
