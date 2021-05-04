const axios = require('axios');
const player = require('play-sound')(opts = {});

const retryTimeInSeconds = 5;
const validVaccines = ['COVISHIELD', 'COVAXIN'];

async function getRequest(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (e) {
        throw e;
    }
}

function findDate() {
    const currentDateTime = new Date();
    const istDateTime = currentDateTime.toLocaleString('en-GB', {timeZone: 'Asia/Calcutta'})
    const splitDateTime = istDateTime.split('/');
    const date = splitDateTime[0];
    const month = splitDateTime[1];
    const year = splitDateTime[2].split(',')[0];
    return `${date}-${month}-${year}`;
}

function generateFilters(age, vaccinePreference) {
    const ageToCheck = age >= 18 && age <= 44 ? 18 : 45;
    let upperCaseVaccinePreference = vaccinePreference && vaccinePreference.toUpperCase();
    if ((upperCaseVaccinePreference && !validVaccines.includes(upperCaseVaccinePreference)) || !upperCaseVaccinePreference) {
        upperCaseVaccinePreference = '';
    }
    const availableVaccines = ['', ...validVaccines];
    const matchVaccineArray = upperCaseVaccinePreference !== '' ? [vaccinePreference.toUpperCase()] : availableVaccines;
    return {ageToCheck, matchVaccineArray};
}

function generateDistrictWiseCentersUrl(districtId) {
    return `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${findDate()}`;
}

async function generateCentersUrl(pinCode, area) {
    let centersUrlArray = [];
    if (area) {
        const getStatesUrl = 'https://cdn-api.co-vin.in/api/v2/admin/location/states';
        const statesData = await getRequest(getStatesUrl);
        let areaArray = area.split('-');
        areaArray = areaArray.map((area) => {
            const result = area.replace( /([A-Z])/g, " $1" );
            return result.charAt(0).toUpperCase() + result.slice(1);
        });
        const state = statesData.states.find((el) => areaArray[0] && areaArray[0].toLowerCase().includes(el.state_name.toLowerCase()));
        if (state) {
            const getDistrictsUrl = `https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state.state_id}`;
            const districtsData = await getRequest(getDistrictsUrl);
            if(areaArray[1]) {
                const district = districtsData.districts.find((el) => areaArray[1] && areaArray[1].toLowerCase().includes(el.district_name.toLowerCase()));
                if (district) {
                    centersUrlArray.push(generateDistrictWiseCentersUrl(district.district_id));
                }
            } else {
                districtsData.districts.map((district) => {
                    centersUrlArray.push(generateDistrictWiseCentersUrl(district.district_id));
                });
            }
        }
    } else if (pinCode) {
        centersUrlArray.push(`https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${pinCode}&date=${findDate()}`);
    }
    return centersUrlArray;
}

async function findVaccinationCenters(intervalId) {
    console.log('-----------');
    let isCenterFound = false;
    const myArgs = process.argv.slice(2);
    let pinCode, area;
    const firstArg = myArgs[0];
    pinCode = firstArg.length === 6 ? firstArg: undefined;
    area = firstArg.length === 6 ? undefined: firstArg;
    const age = myArgs[1] || 45;
    const vaccinePreference = myArgs[2];
    try {
        if (age < 18 || age>=130) {
            console.log('Invalid age entered. Please enter a valid age');
            return true;
        }
        const centersUrlArray = await generateCentersUrl(pinCode, area);
        const {ageToCheck, matchVaccineArray} = generateFilters(age, vaccinePreference);
        if(centersUrlArray.length > 0) {
            await Promise.all(centersUrlArray.map(async (centersUrl) => {
                const {centers} = await getRequest(centersUrl);
                centers.map((center) => {
                    center.sessions.map((session) => {
                        if (session.min_age_limit === ageToCheck && session.available_capacity !== 0 && matchVaccineArray.includes(session.vaccine.toUpperCase())) {
                            isCenterFound = true;
                            const vaccinationLogString = session.vaccine !== '' ? session.vaccine.toUpperCase() : 'Unknown';
                            const pincodeLogString = pinCode ? '' : `(Pin : ${center.pincode}) `;
                            console.log(`${session.available_capacity} slots available at ${center.name} ${pincodeLogString}on ${session.date} with vaccine : ${vaccinationLogString}`);
                        }
                    });
                });
            }));
        } else {
            console.log('Enter valid area. Tip: Enter district in SentenceCase like Delhi-SouthWestDelhi');
            clearInterval(intervalId);
            return true;
        }
        if (!isCenterFound) {
            console.log('No available centers found in pincode/area for age specified for the next 7 days. Try choosing a nearby pincode/area.');
            console.log(`Retrying after ${retryTimeInSeconds} seconds`);
        } else {
            clearInterval(intervalId);
            player.play('./notification.mp3', function (err) {
                if (err) throw err;
            });
        }
        return isCenterFound;
    } catch (e) {
        console.log('Unable to fetch right now. Please try again later.');
        return true;
    }
}

async function run() {
    const isCenterFound = await findVaccinationCenters();
    if(!isCenterFound) {
        const intervalId = setInterval(async () => {
            await findVaccinationCenters(intervalId);
        }, retryTimeInSeconds*1000);
    }
}

run();