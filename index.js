const axios = require('axios');

async function getRequest(url) {
    const configs = { headers : { BearerAuth: 123 } };
    try {
        const response = await axios.get(url, configs);
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
    const validVaccines = ['COVISHIELD', 'COVAXIN'];
    if ((upperCaseVaccinePreference && !validVaccines.includes(upperCaseVaccinePreference)) || !upperCaseVaccinePreference) {
        upperCaseVaccinePreference = '';
    }
    const matchVaccineArray = upperCaseVaccinePreference !== '' ? [vaccinePreference.toUpperCase()] : ['', 'COVISHIELD', 'COVAXIN'];
    return {ageToCheck, matchVaccineArray};
}

async function generateCentersUrl(pinCode, area) {
    let centersUrl;
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
            const district = districtsData.districts.find((el) => areaArray[1] && areaArray[1].toLowerCase().includes(el.district_name.toLowerCase()));
            if (district) {
                centersUrl = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${district.district_id}&date=${findDate()}`;
            }
        }
    } else if (pinCode) {
        centersUrl = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${pinCode}&date=${findDate()}`;
    }
    return centersUrl;
}

async function findVaccinationCenters() {
    const myArgs = process.argv.slice(2);
    let pinCode, area;
    const firstArg = myArgs[0];
    pinCode = firstArg.length === 6 ? firstArg: undefined;
    area = firstArg.length === 6 ? undefined: firstArg;
    const age = myArgs[1] || 45;
    const vaccinePreference = myArgs[2];
    try {
        if (age < 18 || age>=120) {
            console.log('Invalid age entered. Please enter a valid age');
            return;
        }
        const centersUrl = await generateCentersUrl(pinCode, area);
        const {ageToCheck, matchVaccineArray} = generateFilters(age, vaccinePreference);
        let isCenterFound = false;
        if(centersUrl) {
            const {centers} = await getRequest(centersUrl);
            centers.map((center) => {
                center.sessions.map((session) => {
                    if (session.min_age_limit === ageToCheck && session.available_capacity !== 0 && matchVaccineArray.includes(session.vaccine.toUpperCase())) {
                        isCenterFound = true;
                        const vaccinationLogString = session.vaccine !== '' ? session.vaccine.toUpperCase() : 'Not known';
                        const pincodeString = pinCode ? '' : `(Pin : ${center.pincode}) `;
                        console.log(`${session.available_capacity} slots available at ${center.name} ${pincodeString}on ${session.date} with vaccine : ${vaccinationLogString}`);
                    }
                });
            })
        }
        if (!isCenterFound) {
            console.log('No available centers found in pincode/area for age specified for the next 7 days');
            console.log('Try choosing a nearby pincode/area');
        }
    } catch (e) {
        console.log('Error has occurred. Please try again later.');
        console.log('Error message: ', e.message);
    }
}

findVaccinationCenters();